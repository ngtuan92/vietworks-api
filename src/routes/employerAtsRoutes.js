import express from 'express';
import {
  getApplicationsByJob,
  getEmployerApplicationDetail,
  getEmployerAtsJobs,
  markApplicationAsViewed,
  previewEmployerApplicationCv
} from '../controllers/employerAtsController.js';
import { authorize, protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/employer/ats/jobs', protect, authorize('EMPLOYER'), getEmployerAtsJobs);
router.get('/employer/jobs/:jobId/applications', protect, authorize('EMPLOYER'), getApplicationsByJob);
router.get('/employer/applications/:id/cv-view', protect, authorize('EMPLOYER'), previewEmployerApplicationCv);
router.get('/employer/applications/:id', protect, authorize('EMPLOYER'), getEmployerApplicationDetail);
router.patch('/employer/applications/:id/view', protect, authorize('EMPLOYER'), markApplicationAsViewed);

export default router;


