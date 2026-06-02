// routes/employerCompanyRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import {
  getMyCompanyProfile,
  updateMyCompanyProfile,
  submitMyCompanyForVerification
} from '../controllers/employerCompanyController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Employer Company
 *   description: Employer company profile APIs
 */

/**
 * @swagger
 * /api/employer/company/profile:
 *   get:
 *     summary: Employer xem hồ sơ công ty đang gắn với tài khoản của mình
 *     tags: [Employer Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy hồ sơ công ty thành công
 *       400:
 *         description: Employer chưa được gắn công ty
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy công ty
 *       500:
 *         description: Lỗi server
 */
router.get(
  '/employer/company/profile',
  protect,
  authorize(UserRole.EMPLOYER),
  getMyCompanyProfile
);

/**
 * @swagger
 * /api/employer/company/profile:
 *   put:
 *     summary: Employer cập nhật hồ sơ công ty của mình
 *     tags: [Employer Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - taxCode
 *               - industryId
 *               - sizeId
 *               - email
 *               - phone
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: Công ty TNHH ABC
 *               taxCode:
 *                 type: string
 *                 example: "0312345678"
 *               website:
 *                 type: string
 *                 nullable: true
 *                 example: https://abc.com
 *               industryId:
 *                 type: string
 *                 example: 665f1d24e123456789abc111
 *               sizeId:
 *                 type: string
 *                 example: 665f1d24e123456789abc222
 *               email:
 *                 type: string
 *                 example: hr@abc.com
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *               avatarUrl:
 *                 type: string
 *                 nullable: true
 *                 example: https://cdn.example.com/logo.png
 *               coverUrl:
 *                 type: string
 *                 nullable: true
 *                 example: https://cdn.example.com/cover.png
 *               description:
 *                 type: string
 *                 example: Công ty chuyên cung cấp giải pháp phần mềm.
 *               businessLicenseFile:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Cập nhật hồ sơ công ty thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc mã số thuế đã tồn tại
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hồ sơ employer hoặc công ty
 *       500:
 *         description: Lỗi server
 */
router.put(
  '/employer/company/profile',
  protect,
  authorize(UserRole.EMPLOYER),
  updateMyCompanyProfile
);


router.post(
  '/employer/company/profile/submit-verification',
  protect,
  authorize(UserRole.EMPLOYER),
  submitMyCompanyForVerification
);

export default router;