import express from 'express';
import { getMessages, sendMessage, markChatAsRead } from '../controllers/messageController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', sendMessage);
router.get('/:chatId', getMessages);
router.patch('/:chatId/read', markChatAsRead);

export default router;