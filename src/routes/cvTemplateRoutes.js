import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import { upload } from '../utils/cloudinary.js';
import {
  createCvTemplate,
  updateCvTemplate,
  toggleCvTemplateStatus,
  uploadPreviewImage,
  getAdminCvTemplates,
  getActiveCvTemplates,
  getCvTemplatePreview,
  getCareerGroups
} from '../controllers/cvTemplateController.js';

const router = express.Router();

router.get('/', getActiveCvTemplates);
router.get('/career-groups', getCareerGroups);
router.get('/:id/preview', getCvTemplatePreview);

router.get('/admin', protect, authorize(UserRole.ADMIN), getAdminCvTemplates);
router.post('/admin', protect, authorize(UserRole.ADMIN), createCvTemplate);
router.put('/admin/:id', protect, authorize(UserRole.ADMIN), updateCvTemplate);
router.patch('/admin/:id/status', protect, authorize(UserRole.ADMIN), toggleCvTemplateStatus);
router.post('/admin/:id/preview-image', protect, authorize(UserRole.ADMIN), upload.single('previewImage'), uploadPreviewImage);

export default router;
