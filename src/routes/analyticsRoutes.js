import express from 'express';
import { getUserGrowth } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/admin/analytics/user-growth', protect, authorize(UserRole.ADMIN), getUserGrowth);

export default router;