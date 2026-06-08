import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { uploadPdf } from '../utils/cloudinary.js';
import {
  createAiReview,
  getUserReviews,
  getReviewById
} from '../controllers/aiCvReviewController.js';

const router = express.Router();

router.use(protect);

router.post('/', (req, res, next) => {
  uploadPdf.single('file')(req, res, (err) => {
    if (err) {
      let message = 'File không hỗ trợ. Chỉ chấp nhận PDF.';

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
}, createAiReview);

router.get('/', getUserReviews);
router.get('/:id', getReviewById);

export default router;
