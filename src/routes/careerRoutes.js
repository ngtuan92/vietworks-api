// routes/careerRoutes.js
import express from 'express';
import {
  getCareers,
  getCareersByGroup,
  getCareerById,
  createCareer,
  updateCareer,
  softDeleteCareer,
  hardDeleteCareer,
  restoreCareer,
  getActiveCareers,
  updateOrder
} from '../controllers/careerController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { validateCareer } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveCareers);
router.get('/group/:groupId', getCareersByGroup);
router.get('/', getCareers);
router.get('/:id', getCareerById);

// Admin routes
router.post('/', protect, authorize('ADMIN'), validateCareer, createCareer);
router.put('/:id', protect, authorize('ADMIN'), validateCareer, updateCareer);
router.patch('/:id/soft-delete', protect, authorize('ADMIN'), softDeleteCareer);
router.delete('/:id/hard-delete', protect, authorize('ADMIN'), hardDeleteCareer);
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreCareer);
router.patch('/update-order', protect, authorize('ADMIN'), updateOrder);

export default router;