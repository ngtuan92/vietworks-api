import express from 'express';
import { requireJobseeker } from '../middlewares/authMiddleware.js';
import {
  getMyProfile,
  updateMyProfile,
  updatePrivacySettings,
  getNotificationSettings,
  updateNotificationSettings,
} from '../controllers/jobseekerProfileController.js';

const router = express.Router();

router.get('/jobseeker/profile', requireJobseeker, getMyProfile);
router.put('/jobseeker/profile', requireJobseeker, updateMyProfile);
router.patch('/jobseeker/privacy', requireJobseeker, updatePrivacySettings);
router.get('/jobseeker/notification-settings', requireJobseeker, getNotificationSettings);
router.patch('/jobseeker/notification-settings', requireJobseeker, updateNotificationSettings);

export default router;
