import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createCv,
  updateCv,
  getCvById,
  getUserCvs,
  deleteCv
} from '../controllers/cvController.js';

const router = express.Router();

// Tất cả thao tác về CV đều cần đăng nhập
router.use(protect);

router.post('/', createCv);
router.get('/', getUserCvs);
router.get('/:id', getCvById);
router.put('/:id', updateCv);
router.delete('/:id', deleteCv);

export default router;
