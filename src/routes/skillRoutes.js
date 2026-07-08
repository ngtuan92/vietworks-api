// routes/skillRoutes.js
import express from 'express';
import {
  getSkills,
  getSkillsByCareerGroup,
  getActiveSkills,
  getSkillById,
  createSkill,
  updateSkill,
  softDeleteSkill,
  hardDeleteSkill,
  restoreSkill,
  bulkUpdateSkills
} from '../controllers/skillController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { validateSkill } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveSkills);
router.get('/group/:groupId', getSkillsByCareerGroup);
router.get('/', getSkills);
router.get('/:id', getSkillById);

// Admin routes
router.post('/', protect, authorize('ADMIN'), validateSkill, createSkill);
router.put('/:id', protect, authorize('ADMIN'), validateSkill, updateSkill);
router.patch('/:id/soft-delete', protect, authorize('ADMIN'), softDeleteSkill);
router.delete('/:id/hard-delete', protect, authorize('ADMIN'), hardDeleteSkill);
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreSkill);
router.patch('/bulk-update', protect, authorize('ADMIN'), bulkUpdateSkills);

export default router;