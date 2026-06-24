import express from 'express';
import { getUserGrowth, getJobAnalytics, getApplicationAnalytics, getHiringSuccess } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/admin/analytics/user-growth', protect, authorize(UserRole.ADMIN), getUserGrowth);
router.get('/admin/analytics/jobs', protect, authorize(UserRole.ADMIN), getJobAnalytics);
router.get('/admin/analytics/applications', protect, authorize(UserRole.ADMIN), getApplicationAnalytics);
router.get('/admin/analytics/hiring-success', protect, authorize(UserRole.ADMIN), getHiringSuccess);

export default router;