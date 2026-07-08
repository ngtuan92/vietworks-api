// routes/careerGroupRoutes.js
import express from 'express';
import {
  getCareerGroups,
  getCareerGroupById,
  createCareerGroup,
  updateCareerGroup,
  softDeleteCareerGroup,
  hardDeleteCareerGroup,
  restoreCareerGroup,
  getActiveCareerGroups,
  updateOrder
} from '../controllers/careerGroupController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { validateCareerGroup } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveCareerGroups);
router.get('/', getCareerGroups);
router.get('/:id', getCareerGroupById);

// Admin routes (cần xác thực và phân quyền)
router.post('/', protect, authorize('ADMIN'), validateCareerGroup, createCareerGroup);
router.put('/:id', protect, authorize('ADMIN'), validateCareerGroup, updateCareerGroup);
router.patch('/:id/soft-delete', protect, authorize('ADMIN'), softDeleteCareerGroup);
router.delete('/:id/hard-delete', protect, authorize('ADMIN'), hardDeleteCareerGroup);
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreCareerGroup);
router.patch('/update-order', protect, authorize('ADMIN'), updateOrder);

export default router;