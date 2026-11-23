import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/zip': '.zip',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const randomId = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${randomId}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimes = Object.keys(MIME_TO_EXT);
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Unsupported file type');
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

export const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File size exceeds the 10 MB limit' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }

    if (err.statusCode === 400 || err.message === 'Unsupported file type') {
      return res.status(400).json({ message: err.message || 'Invalid file upload' });
    }

    return next(err);
  });
};

export const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  const cleanOriginalName = path.basename(req.file.originalname || 'attachment');

  return res.status(201).json({
    url: fileUrl,
    name: cleanOriginalName,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
};