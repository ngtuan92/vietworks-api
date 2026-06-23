import express from 'express';
import { getBoostPackages, createBoostPayment, activateCvBoost } from '../controllers/jobseekerBoostController.js';
import { protect, authorize, internalSecret, optionalAuth } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/jobseeker/packages/boost-cv', optionalAuth, getBoostPackages);
router.post('/jobseeker/cvs/:cvId/boost/payment', protect, authorize(UserRole.JOBSEEKER), createBoostPayment);
router.patch('/internal/cv-boosts/activate', internalSecret, activateCvBoost);

export default router;