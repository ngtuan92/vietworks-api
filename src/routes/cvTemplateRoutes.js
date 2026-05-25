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

router.get('/admin', getAdminCvTemplates);
router.post('/admin', createCvTemplate);
router.put('/admin/:id', updateCvTemplate);
router.patch('/admin/:id/status', toggleCvTemplateStatus);
router.post('/admin/:id/preview-image', upload.single('previewImage'), uploadPreviewImage);

export default router;
