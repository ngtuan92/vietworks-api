import express from 'express';
import {
  getApplicationsByJob,
  getEmployerApplicationDetail,
  getEmployerAtsJobs,
  markApplicationAsViewed,
  previewEmployerApplicationCv,
  approveApplication,
  rejectApplication,
  createInterviewInvitation
} from '../controllers/employerAtsController.js';
import { getEmployerDashboardAnalytics } from '../controllers/employerAnalyticsController.js';
import { authorize, protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/employer/analytics/dashboard', protect, authorize('EMPLOYER'), getEmployerDashboardAnalytics);
router.get('/employer/ats/jobs', protect, authorize('EMPLOYER'), getEmployerAtsJobs);
router.get('/employer/jobs/:jobId/applications', protect, authorize('EMPLOYER'), getApplicationsByJob);
router.get('/employer/applications/:id/cv-view', protect, authorize('EMPLOYER'), previewEmployerApplicationCv);
router.get('/employer/applications/:id', protect, authorize('EMPLOYER'), getEmployerApplicationDetail);
router.patch('/employer/applications/:id/view', protect, authorize('EMPLOYER'), markApplicationAsViewed);
router.patch('/employer/applications/:id/approve', protect, authorize('EMPLOYER'), approveApplication);
router.patch('/employer/applications/:id/reject', protect, authorize('EMPLOYER'), rejectApplication);
router.post('/employer/applications/:id/interview-invitation', protect, authorize('EMPLOYER'), createInterviewInvitation);

export default router;


