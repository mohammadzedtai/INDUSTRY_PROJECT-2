import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const cleanName = String(req.body?.name || '').trim();
    const cleanEmail = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar.trim() : '';

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      ...(avatar && { avatar }),
    });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error during login' });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  return res.json(req.user);
};

// GET /api/auth/users?search=riya
export const searchUsers = async (req, res) => {
  try {
    const rawSearch = String(req.query?.search || '').trim();
    const safePattern = escapeRegex(rawSearch);

    const keyword = rawSearch
      ? {
          $or: [
            { name: { $regex: safePattern, $options: 'i' } },
            { email: { $regex: safePattern, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find({
      ...keyword,
      _id: { $ne: req.user._id },
    })
      .select('name email avatar lastSeen')
      .limit(20);

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to search users' });
  }
};