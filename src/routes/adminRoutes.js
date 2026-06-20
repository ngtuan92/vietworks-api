import express from 'express';
import { getAllUsers, getUserById, banUser, unbanUser } from '../controllers/adminUserController.js';
import { getAllTransactions, getTransactionById, getRevenueReport } from '../controllers/adminTransactionController.js';
import { requestInvoice } from '../controllers/invoiceController.js';
import { getEmailLogs } from '../controllers/emailLogController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.use(protect);

// Admin Transaction Routes
router.get('/admin/transactions', authorize(UserRole.ADMIN), getAllTransactions);
router.get('/admin/transactions/:id', authorize(UserRole.ADMIN), getTransactionById);
router.get('/admin/revenue-report', authorize(UserRole.ADMIN), getRevenueReport);

// Admin User Management Routes
router.get('/admin/users', authorize(UserRole.ADMIN), getAllUsers);
router.get('/admin/users/:id', authorize(UserRole.ADMIN), getUserById);
router.patch('/admin/users/:id/ban', authorize(UserRole.ADMIN), banUser);
router.patch('/admin/users/:id/unban', authorize(UserRole.ADMIN), unbanUser);

// Invoice Request Route
router.post('/transactions/:id/invoice-request', protect, requestInvoice);

// Email Logs Route
router.get('/admin/email-logs', authorize(UserRole.ADMIN), getEmailLogs);

export default router;