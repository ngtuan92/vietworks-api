import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { uploadPdf } from '../utils/cloudinary.js';
import {
  uploadCv,
  getUserUploadedCvs,
  getUploadedCvById,
  updateUploadedCv,
  deleteUploadedCv
} from '../controllers/uploadedCvController.js';

const router = express.Router();

router.use(protect);

router.post('/upload', (req, res, next) => {
  uploadPdf.single('file')(req, res, (err) => {
    if (err) {
      let message = 'File không hỗ trợ. Chỉ chấp nhận PDF, DOC, DOCX.';

      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.';
      } else if (err.message) {
        message = err.message;
      }

      return res.status(400).json({
        success: false,
        message
      });
    }
    next();
  });
}, uploadCv);
router.get('/', getUserUploadedCvs);
router.get('/:id', getUploadedCvById);
router.put('/:id', updateUploadedCv);
router.delete('/:id', deleteUploadedCv);

export default router;