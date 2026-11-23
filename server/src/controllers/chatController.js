import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/chats (Access or create 1-on-1 chat)
export const accessChat = async (req, res) => {
  try {
    const targetUserId = String(req.body?.userId || '').trim();
    if (!targetUserId || !isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: 'Valid target userId is required' });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot create a direct chat with yourself' });
    }

    const targetUserExists = await User.exists({ _id: targetUserId });
    if (!targetUserExists) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, targetUserId], $size: 2 },
    })
      .populate('participants', '-password')
      .populate('latestMessage');

    if (chat) {
      if (chat.latestMessage) {
        chat = await User.populate(chat, {
          path: 'latestMessage.sender',
          select: 'name avatar email',
        });
      }
      return res.json(chat);
    }

    const createdChat = await Chat.create({
      chatName: 'sender',
      isGroup: false,
      participants: [req.user._id, targetUserId],
    });

    const fullChat = await Chat.findById(createdChat._id).populate(
      'participants',
      '-password'
    );

    return res.status(201).json(fullChat);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to access chat' });
  }
};

// GET /api/chats (Fetch all chats for logged-in user)
export const fetchChats = async (req, res) => {
  try {
    let chats = await Chat.find({
      participants: req.user._id,
    })
      .populate('participants', '-password')
      .populate('groupAdmin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    chats = await User.populate(chats, {
      path: 'latestMessage.sender',
      select: 'name avatar email',
    });

    return res.json(chats);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch chats' });
  }
};

// POST /api/chats/group (Create a group chat)
export const createGroupChat = async (req, res) => {
  try {
    const cleanName = String(req.body?.name || '').trim();
    const rawUsers = req.body?.users;

    if (!cleanName || !Array.isArray(rawUsers)) {
      return res.status(400).json({
        message: 'Group name and a valid users list are required',
      });
    }

    const validOtherIds = [
      ...new Set(
        rawUsers
          .map((id) => String(id || '').trim())
          .filter((id) => isValidObjectId(id) && id !== req.user._id.toString())
      ),
    ];

    if (validOtherIds.length < 2) {
      return res.status(400).json({
        message: 'At least 2 other valid members are required to create a group',
      });
    }

    const existingUsersCount = await User.countDocuments({
      _id: { $in: validOtherIds },
    });

    if (existingUsersCount !== validOtherIds.length) {
      return res.status(400).json({
        message: 'One or more selected users do not exist',
      });
    }

    const participants = [...new Set([...validOtherIds, req.user._id.toString()])];

    const groupChat = await Chat.create({
      chatName: cleanName,
      isGroup: true,
      participants,
      groupAdmin: req.user._id,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('participants', '-password')
      .populate('groupAdmin', '-password');

    return res.status(201).json(fullGroupChat);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create group chat' });
  }
};