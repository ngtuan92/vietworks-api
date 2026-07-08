// routes/careerPositionRoutes.js
import express from 'express';
import {
  getCareerPositions,
  getPositionsByCareer,
  getPositionsByGroup,
  getCareerPositionById,
  createCareerPosition,
  updateCareerPosition,
  softDeleteCareerPosition,
  hardDeleteCareerPosition,
  restoreCareerPosition,
  getActivePositions,
  updateOrder
} from '../controllers/careerPositionController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { validateCareerPosition } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', getActivePositions);
router.get('/career/:careerId', getPositionsByCareer);
router.get('/group/:groupId', getPositionsByGroup);
router.get('/', getCareerPositions);
router.get('/:id', getCareerPositionById);

// Admin routes
router.post('/', protect, authorize('ADMIN'), validateCareerPosition, createCareerPosition);
router.put('/:id', protect, authorize('ADMIN'), validateCareerPosition, updateCareerPosition);
router.patch('/:id/soft-delete', protect, authorize('ADMIN'), softDeleteCareerPosition);
router.delete('/:id/hard-delete', protect, authorize('ADMIN'), hardDeleteCareerPosition);
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreCareerPosition);
router.patch('/update-order', protect, authorize('ADMIN'), updateOrder);

export default router;