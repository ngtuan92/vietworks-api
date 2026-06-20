import express from 'express';
import { createPackage, updatePackage, updatePackageStatus, getPackages, getAllPackages, getPackageById } from '../controllers/packageController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

// Public routes
router.get('/packages', getPackages);

// Admin routes — áp dụng protect + authorize THEO TỪNG ROUTE.
// KHÔNG dùng router.use(...) vì router này mount ở '/api' (dùng chung),
// router.use sẽ chạy cho MỌI request /api/* và chặn nhầm route của router khác (ví, giao dịch...).
const adminOnly = [protect, authorize(UserRole.ADMIN)];
router.get('/admin/packages', adminOnly, getAllPackages);
router.get('/admin/packages/:id', adminOnly, getPackageById);
router.post('/admin/packages', adminOnly, createPackage);
router.put('/admin/packages/:id', adminOnly, updatePackage);
router.patch('/admin/packages/:id/status', adminOnly, updatePackageStatus);

export default router;