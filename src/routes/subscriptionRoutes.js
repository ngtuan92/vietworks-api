// routes/subscriptionRoutes.js
// Mount vào /api theo app.js hiện tại.

import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  renewSubscription,
  cancelSubscription,
  activateTrial
} from '../controllers/subscriptionController.js';

const router = express.Router();

// Gia hạn subscription hiện tại (cùng packageCode) - cộng dồn expiredAt
router.post('/subscriptions/:id/renew', protect, renewSubscription);

// Hủy subscription đang hoạt động
router.post('/subscriptions/:id/cancel', protect, cancelSubscription);

// Kích hoạt Trial miễn phí cho CV/Job đầu tiên của user mới
router.post('/trial/activate', protect, activateTrial);

export default router;