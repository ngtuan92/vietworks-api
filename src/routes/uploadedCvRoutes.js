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

router.post('/upload', uploadPdf.single('file'), uploadCv);
router.get('/', getUserUploadedCvs);
router.get('/:id', getUploadedCvById);
router.put('/:id', updateUploadedCv);
router.delete('/:id', deleteUploadedCv);

export default router;