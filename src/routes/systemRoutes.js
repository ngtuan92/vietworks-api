import express from 'express';
import { expirePremiumServices } from '../controllers/cronController.js';
import { internalSecret } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.patch('/system/cron/expire-premium-services', internalSecret, expirePremiumServices);

export default router;