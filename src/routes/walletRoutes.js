import express from 'express';
import { createWallet, getWallet, deposit, sepayWebhook, getTransactions } from '../controllers/walletController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.post('/employer/wallet', protect, authorize(UserRole.EMPLOYER), createWallet);
router.get('/employer/wallet', protect, authorize(UserRole.EMPLOYER), getWallet);
router.post('/employer/wallet/deposit', protect, authorize(UserRole.EMPLOYER), deposit);
router.get('/employer/transactions', protect, authorize(UserRole.EMPLOYER), getTransactions);

router.post('/payments/sepay/webhook', sepayWebhook);

export default router;