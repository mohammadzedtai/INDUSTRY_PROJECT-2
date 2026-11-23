import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { handleUpload, uploadFile } from '../controllers/uploadController.js';

const router = express.Router();

// POST /api/upload
router.post('/', protect, handleUpload, uploadFile);

export default router;