// routes/jobLevelRoutes.js
import express from 'express';
import {
  getJobLevels,
  getActiveJobLevels,
  getJobLevelById,
  createJobLevel,
  updateJobLevel,
  softDeleteJobLevel,
  hardDeleteJobLevel,
  restoreJobLevel,
  updateOrder
} from '../controllers/jobLevelController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { validateJobLevel } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveJobLevels);
router.get('/', getJobLevels);
router.get('/:id', getJobLevelById);

// Admin routes
router.post('/', protect, authorize('ADMIN'), validateJobLevel, createJobLevel);
router.put('/:id', protect, authorize('ADMIN'), validateJobLevel, updateJobLevel);
router.patch('/:id/soft-delete', protect, authorize('ADMIN'), softDeleteJobLevel);
router.delete('/:id/hard-delete', protect, authorize('ADMIN'), hardDeleteJobLevel);
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreJobLevel);
router.patch('/update-order', protect, authorize('ADMIN'), updateOrder);

export default router;