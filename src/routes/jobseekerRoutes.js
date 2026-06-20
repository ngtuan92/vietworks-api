import express from 'express';
import { getTransactions } from '../controllers/walletController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/jobseeker/transactions', protect, authorize(UserRole.JOBSEEKER), getTransactions);

export default router;