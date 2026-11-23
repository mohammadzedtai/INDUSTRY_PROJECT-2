import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isUserParticipant = async (chatId, userId) => {
  const chat = await Chat.findById(chatId).select('participants').lean();
  if (!chat) {
    return { errorStatus: 404, message: 'Chat not found' };
  }
  const allowed = chat.participants.some(
    (participantId) => participantId.toString() === userId.toString()
  );
  if (!allowed) {
    return { errorStatus: 403, message: 'Not authorized to access this chat' };
  }
  return { errorStatus: null };
};

const normalizeAttachment = (rawAttachment) => {
  if (!rawAttachment || typeof rawAttachment !== 'object' || !rawAttachment.url) {
    return null;
  }
  const url = String(rawAttachment.url).trim();
  if (!url) return null;

  const sizeNum = Number(rawAttachment.size);
  return {
    url,
    name: typeof rawAttachment.name === 'string' ? rawAttachment.name.trim() : 'attachment',
    mimeType: typeof rawAttachment.mimeType === 'string' ? rawAttachment.mimeType.trim() : '',
    size: Number.isFinite(sizeNum) && sizeNum >= 0 ? sizeNum : 0,
  };
};

// GET /api/messages/:chatId?page=1&limit=30
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId' });
    }

    const access = await isUserParticipant(chatId, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.message });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chatId })
      .populate('sender', 'name avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json(messages.reverse());
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load messages' });
  }
};

// POST /api/messages
export const sendMessage = async (req, res) => {
  try {
    const cleanChatId = String(req.body?.chatId || '').trim();
    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const attachment = normalizeAttachment(req.body?.attachment);

    if (!cleanChatId || !isValidObjectId(cleanChatId)) {
      return res.status(400).json({ message: 'Valid chatId is required' });
    }

    if (!rawContent && !attachment) {
      return res.status(400).json({ message: 'Content or attachment is required' });
    }

    const access = await isUserParticipant(cleanChatId, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.message });
    }

    const finalContent = rawContent || (attachment ? attachment.name : '');

    const newMessage = await Message.create({
      chatId: cleanChatId,
      sender: req.user._id,
      content: finalContent,
      ...(attachment && { attachment }),
      status: 'sent',
    });

    const populatedMessage = await newMessage.populate('sender', 'name avatar email');

    await Chat.findByIdAndUpdate(cleanChatId, {
      latestMessage: newMessage._id,
    });

    return res.status(201).json(populatedMessage);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message' });
  }
};

// PATCH /api/messages/:chatId/read (Mark all unread messages in chat as read)
export const markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId' });
    }

    const access = await isUserParticipant(chatId, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.message });
    }

    await Message.updateMany(
      {
        chatId,
        sender: { $ne: req.user._id },
        status: { $ne: 'read' },
      },
      {
        $set: { status: 'read' },
        $addToSet: { readBy: req.user._id },
      }
    );

    return res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update read status' });
  }
};