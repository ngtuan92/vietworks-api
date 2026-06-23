import express from 'express';
import { createWallet, getWallet, deposit, sepayWebhook, getTransactions, checkSepayPayment, getTransactionByOrderCode, getMySubscriptions } from '../controllers/walletController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.post('/employer/wallet', protect, authorize(UserRole.EMPLOYER), createWallet);
router.get('/employer/wallet', protect, authorize(UserRole.EMPLOYER), getWallet);
router.post('/employer/wallet/deposit', protect, authorize(UserRole.EMPLOYER), deposit);
router.get('/employer/transactions', protect, authorize(UserRole.EMPLOYER), getTransactions);

router.post('/payments/sepay/webhook', sepayWebhook);

// Fallback: FE hỏi xem giao dịch đã thanh toán chưa (khi SePay miss webhook - VietinBank hay miss).
// Chỉ cần đăng nhập; handler tự kiểm tra giao dịch thuộc đúng user.
router.get('/transactions/sepay-check/:orderCode', protect, checkSepayPayment);

// FE PaymentSuccess page gọi để fetch chi tiết giao dịch + gói + target
router.get('/transactions/by-order-code/:orderCode', protect, getTransactionByOrderCode);

// My subscriptions (cho cả employer và jobseeker - phân biệt bằng role middleware)
router.get('/employer/my-subscriptions', protect, authorize(UserRole.EMPLOYER), getMySubscriptions);
router.get('/jobseeker/my-subscriptions', protect, authorize(UserRole.JOBSEEKER), getMySubscriptions);

export default router;
