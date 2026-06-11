// routes/adminCompanyVerificationRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import {
  getPendingCompanies,
  getCompanyVerificationDetail,
  approveCompanyVerification,
  rejectCompanyVerification
} from '../controllers/adminCompanyVerificationController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Company Verification
 *   description: Admin company legal verification APIs
 */

/**
 * @swagger
 * /api/admin/company-verifications/pending:
 *   get:
 *     summary: Admin xem danh sách công ty đang chờ duyệt
 *     description: Chỉ lấy các công ty có verificationStatus là PENDING.
 *     tags: [Admin Company Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách công ty chờ duyệt thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
 */
router.get(
  '/admin/company-verifications/pending',
  protect,
  authorize(UserRole.ADMIN),
  getPendingCompanies
);

/**
 * @swagger
 * /api/admin/company-verifications/{companyId}:
 *   get:
 *     summary: Admin xem chi tiết hồ sơ công ty đang chờ duyệt
 *     description: Xem thông tin doanh nghiệp, chủ sở hữu, địa điểm và file giấy phép đã upload để đối chiếu.
 *     tags: [Admin Company Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID công ty cần xem chi tiết
 *     responses:
 *       200:
 *         description: Lấy chi tiết hồ sơ công ty thành công
 *       400:
 *         description: companyId không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 *       404:
 *         description: Không tìm thấy công ty đang chờ duyệt
 *       500:
 *         description: Lỗi server
 */
router.get(
  '/admin/company-verifications/:companyId',
  protect,
  authorize(UserRole.ADMIN),
  getCompanyVerificationDetail
);


router.patch(
  '/admin/company-verifications/:companyId/approve',
  protect,
  authorize(UserRole.ADMIN),
  approveCompanyVerification
);

router.patch(
  '/admin/company-verifications/:companyId/reject',
  protect,
  authorize(UserRole.ADMIN),
  rejectCompanyVerification
);

export default router;