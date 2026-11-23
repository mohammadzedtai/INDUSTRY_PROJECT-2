import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// userId -> Set of active socketIds (supports multiple tabs/devices)
const userSockets = new Map();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const addUserSocket = (userId, socketId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  userSockets.get(key).add(socketId);
};

const removeUserSocket = (userId, socketId) => {
  const key = String(userId);
  const sockets = userSockets.get(key);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(key);
  }
};

const isChatParticipant = async (chatId, userId) => {
  if (!chatId || !isValidObjectId(chatId)) return false;
  const exists = await Chat.exists({ _id: chatId, participants: userId });
  return Boolean(exists);
};

const sanitizeAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return null;

  const url = typeof attachment.url === 'string' ? attachment.url.trim() : '';
  const name = typeof attachment.name === 'string' ? attachment.name.trim() : '';
  const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType.trim() : '';

  if (!url || !name || !mimeType) return null;

  const parsedSize = Number(attachment.size);
  return {
    url,
    name,
    mimeType,
    size: Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : 0,
  };
};

export const initSocket = (io) => {
  // JWT Authentication for Socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded?.id || decoded?.userId || decoded?._id;
      if (!userId) {
        return next(new Error('Authentication error: Invalid token payload'));
      }
      socket.userId = String(userId);
      return next();
    } catch (_err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    addUserSocket(userId, socket.id);
    socket.join(userId);

    io.emit('online_users', Array.from(userSockets.keys()));

    // Join specific chat room (only if participant)
    socket.on('join_chat', async (chatId) => {
      try {
        const cleanChatId = String(chatId || '').trim();
        if (!(await isChatParticipant(cleanChatId, userId))) return;
        socket.join(cleanChatId);
      } catch (error) {
        console.error('Socket join_chat error:', error);
      }
    });

    // Typing indicators
    socket.on('typing', async (payload = {}) => {
      try {
        const chatId = String(payload?.chatId || '').trim();
        if (!(await isChatParticipant(chatId, userId))) return;
        socket.to(chatId).emit('user_typing', { chatId, userId });
      } catch (error) {
        console.error('Socket typing error:', error);
      }
    });

    socket.on('stop_typing', async (payload = {}) => {
      try {
        const chatId = String(payload?.chatId || '').trim();
        if (!(await isChatParticipant(chatId, userId))) return;
        socket.to(chatId).emit('user_stop_typing', { chatId, userId });
      } catch (error) {
        console.error('Socket stop_typing error:', error);
      }
    });

    // Send & save message (text + optional attachment) in real time
    socket.on('send_message', async (payload = {}) => {
      try {
        const chatId = String(payload?.chatId || '').trim();
        const cleanContent = typeof payload?.content === 'string' ? payload.content.trim() : '';
        const cleanAttachment = sanitizeAttachment(payload?.attachment);

        if (!chatId || !isValidObjectId(chatId)) {
          return socket.emit('error_message', { message: 'Valid chatId is required' });
        }

        if (!cleanContent && !cleanAttachment) {
          return socket.emit('error_message', {
            message: 'Message content or attachment is required',
          });
        }

        const allowed = await isChatParticipant(chatId, userId);
        if (!allowed) {
          return socket.emit('error_message', {
            message: 'Not authorized to send messages in this chat',
          });
        }

        const newMessage = await Message.create({
          chatId,
          sender: userId,
          content: cleanContent || (cleanAttachment ? cleanAttachment.name : ''),
          ...(cleanAttachment && { attachment: cleanAttachment }),
          status: 'sent',
        });

        const populatedMessage = await newMessage.populate('sender', 'name avatar email');

        await Chat.findByIdAndUpdate(chatId, {
          latestMessage: newMessage._id,
        });

        io.to(chatId).emit('receive_message', populatedMessage);
      } catch (error) {
        console.error('Socket send_message error:', error);
        return socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    // Mark incoming messages in a chat as READ in real time
    socket.on('mark_read', async (payload = {}) => {
      try {
        const chatId = String(payload?.chatId || '').trim();
        if (!(await isChatParticipant(chatId, userId))) return;

        const result = await Message.updateMany(
          {
            chatId,
            sender: { $ne: userId },
            status: { $ne: 'read' },
          },
          {
            $set: { status: 'read' },
            $addToSet: { readBy: userId },
          }
        );

        if (result.modifiedCount > 0) {
          io.to(chatId).emit('chat_messages_read', {
            chatId,
            readerId: userId,
          });
        }
      } catch (error) {
        console.error('Socket mark_read error:', error);
      }
    });

    // Delete a message (only allowed for the sender)
    socket.on('delete_message', async (payload = {}) => {
      try {
        const messageId = String(payload?.messageId || '').trim();
        if (!messageId || !isValidObjectId(messageId)) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        if (message.sender.toString() !== userId) {
          return socket.emit('error_message', {
            message: 'You can only delete your own messages',
          });
        }

        const targetChatId =
          payload?.chatId && isValidObjectId(String(payload.chatId).trim())
            ? String(payload.chatId).trim()
            : message.chatId.toString();

        const chat = await Chat.findById(targetChatId);
        const wasLatest = Boolean(chat && chat.latestMessage?.toString() === messageId);

        await Message.findByIdAndDelete(messageId);

        let newLatestMessage = null;
        if (wasLatest) {
          const prevLatest = await Message.findOne({ chatId: targetChatId })
            .sort({ createdAt: -1 })
            .populate('sender', 'name avatar email');

          newLatestMessage = prevLatest || null;
          await Chat.findByIdAndUpdate(targetChatId, {
            latestMessage: prevLatest ? prevLatest._id : null,
          });
        }

        io.to(targetChatId).emit('message_deleted', {
          messageId,
          chatId: targetChatId,
          newLatestMessage,
          wasLatest,
        });
      } catch (error) {
        console.error('Socket delete_message error:', error);
        return socket.emit('error_message', { message: 'Failed to delete message' });
      }
    });

    socket.on('disconnect', async () => {
      removeUserSocket(userId, socket.id);
      io.emit('online_users', Array.from(userSockets.keys()));

      if (!userSockets.has(userId)) {
        try {
          await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        } catch (error) {
          console.error('Socket disconnect lastSeen error:', error);
        }
      }
    });
  });
};