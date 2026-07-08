import express from 'express';
import { getAllUsers, getUserById } from '../controllers/adminUserController.js';
import { getAllTransactions, getTransactionById, getRevenueReport, getSepayWebhookLogs, replaySepayWebhookLog } from '../controllers/adminTransactionController.js';
import { requestInvoice } from '../controllers/invoiceController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

// Áp dụng protect + authorize THEO TỪNG ROUTE (không dùng router.use vì router này
// mount ở '/api' chung — router.use sẽ rò rỉ sang request của router khác).
const adminOnly = [protect, authorize(UserRole.ADMIN)];

// Admin Transaction Routes
router.get('/admin/transactions', adminOnly, getAllTransactions);
router.get('/admin/transactions/:id', adminOnly, getTransactionById);
router.get('/admin/revenue-report', adminOnly, getRevenueReport);

// Admin SePay Webhook Logs (debug/audit/replay)
router.get('/admin/sepay-webhook-logs', adminOnly, getSepayWebhookLogs);
router.post('/admin/sepay-webhook-logs/:id/replay', adminOnly, replaySepayWebhookLog);

// Admin User Management Routes
router.get('/admin/users', adminOnly, getAllUsers);
router.get('/admin/users/:id', adminOnly, getUserById);

// Invoice Request Route (chỉ cần đăng nhập, không bắt buộc admin)
router.post('/transactions/:id/invoice-request', protect, requestInvoice);



export default router;