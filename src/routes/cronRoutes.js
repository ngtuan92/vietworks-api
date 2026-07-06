// routes/cronRoutes.js
// Endpoint cho scheduler ngoài (GitHub Actions, cron-job.org, ...) gọi vào.
//
// Mount vào /api theo app.js hiện tại.
// Cả 2 endpoint đều yêu cầu header `x-internal-secret: <INTERNAL_SECRET>`.

import express from 'express';
import { internalSecret } from '../middlewares/authMiddleware.js';
import {
  expirePremiumServices,
  notifyExpiringSoonOnly
} from '../controllers/expireNotifyController.js';

const router = express.Router();

// 00:00 daily: set EXPIRED + notify user đã hết hạn
router.patch('/system/cron/expire-premium-services', internalSecret, expirePremiumServices);

// 09:00 daily: notify user sắp hết hạn (3 ngày trước) — tách riêng để không spam
router.patch('/system/cron/notify-expiring-soon', internalSecret, notifyExpiringSoonOnly);

export default router;