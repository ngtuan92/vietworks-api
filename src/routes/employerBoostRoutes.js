import express from 'express';
import { createBoostPayment, activateJobBoost, getActiveJobBoosts } from '../controllers/employerBoostController.js';
import { protect, authorize, internalSecret } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/employer/active-packages', protect, authorize(UserRole.EMPLOYER), getActiveJobBoosts);
router.post('/employer/jobs/:jobId/boost/payment', protect, authorize(UserRole.EMPLOYER), createBoostPayment);
router.patch('/internal/job-boosts/activate', internalSecret, activateJobBoost);

export default router;