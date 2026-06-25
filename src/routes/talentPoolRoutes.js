import express from 'express';
import { getTalentPool, unlockCandidate, getUnlockedCandidates, purchaseCvUnlockPackage } from '../controllers/talentPoolController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/employer/talent-pool', protect, authorize(UserRole.EMPLOYER), getTalentPool);
router.post('/employer/talent-pool/:candidateId/unlock', protect, authorize(UserRole.EMPLOYER), unlockCandidate);
router.get('/employer/unlocked-candidates', protect, authorize(UserRole.EMPLOYER), getUnlockedCandidates);

// Mua gói Mở khóa CV (CV_UNLOCK / CV_UNLOCK_BUNDLE) bằng ví → cấp lượt mở khóa
router.post('/employer/cv-unlock/purchase', protect, authorize(UserRole.EMPLOYER), purchaseCvUnlockPackage);

export default router;
