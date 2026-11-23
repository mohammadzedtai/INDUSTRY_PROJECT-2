import express from 'express';
import { accessChat, fetchChats, createGroupChat } from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect); // All chat routes require authentication

router.route('/').get(fetchChats).post(accessChat);
router.post('/group', createGroupChat);

export default router;