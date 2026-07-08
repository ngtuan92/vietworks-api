import express from 'express';
import { getTalentPool, unlockCandidate, getUnlockedCandidates, purchaseCvUnlockPackage, getCvUnlockCredits, getTalentPoolCvPreview } from '../controllers/talentPoolController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/employer/talent-pool', protect, authorize(UserRole.EMPLOYER), getTalentPool);
router.post('/employer/talent-pool/:candidateId/unlock', protect, authorize(UserRole.EMPLOYER), unlockCandidate);
router.get('/employer/unlocked-candidates', protect, authorize(UserRole.EMPLOYER), getUnlockedCandidates);
router.get('/employer/talent-pool/cv-preview/:cvId', protect, authorize(UserRole.EMPLOYER), getTalentPoolCvPreview);

// Mua / nâng cấp gói Mở khóa CV (CV_UNLOCK / CV_UNLOCK_BUNDLE) bằng ví → cấp lượt mở khóa
router.get('/employer/cv-unlock/credits', protect, authorize(UserRole.EMPLOYER), getCvUnlockCredits);
router.post('/employer/cv-unlock/purchase', protect, authorize(UserRole.EMPLOYER), purchaseCvUnlockPackage);

// Mời phỏng vấn trực tiếp từ Talent Pool (yêu cầu đã mở khóa)
import { inviteToInterview } from '../controllers/talentPoolController.js';
router.post('/employer/talent-pool/:candidateId/interview-invitation', protect, authorize(UserRole.EMPLOYER), inviteToInterview);

export default router;
