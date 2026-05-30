// routes/employerAccountRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import {
  getMyRepresentativeProfile,
  getMyEmployerLoginInfo,
    updateMyRepresentativeProfile,
  updateMyEmployerPassword
} from '../controllers/employerAccountController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Employer Account
 *   description: Employer account APIs
 */

/**
 * @swagger
 * /api/employer/account/representative:
 *   get:
 *     summary: Xem thông tin người đại diện của employer đang đăng nhập
 *     tags: [Employer Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin người đại diện thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 665f1d24e123456789abc111
 *                     representativeName:
 *                       type: string
 *                       example: Nguyen Van A
 *                     gender:
 *                       type: string
 *                       example: MALE
 *                     phone:
 *                       type: string
 *                       example: "0901234567"
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hồ sơ employer
 *       500:
 *         description: Lỗi server
 */
router.get(
  '/employer/account/representative',
  protect,
  authorize(UserRole.EMPLOYER),
  getMyRepresentativeProfile
);


/**
 * @swagger
 * /api/employer/account/representative:
 *   put:
 *     summary: Cập nhật thông tin người đại diện của employer đang đăng nhập
 *     tags: [Employer Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - representativeName
 *               - gender
 *               - phone
 *             properties:
 *               representativeName:
 *                 type: string
 *                 example: Nguyen Van A
 *               gender:
 *                 type: string
 *                 example: MALE
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       200:
 *         description: Cập nhật thông tin người đại diện thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hồ sơ employer
 *       500:
 *         description: Lỗi server
 */
router.put(
  '/employer/account/representative',
  protect,
  authorize(UserRole.EMPLOYER),
  updateMyRepresentativeProfile
);

/**
 * @swagger
 * /api/employer/account:
 *   get:
 *     summary: Xem email và trạng thái mật khẩu của employer đang đăng nhập
 *     description: Không trả về mật khẩu gốc vì mật khẩu đã được hash.
 *     tags: [Employer Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin tài khoản thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: employer@example.com
 *                     authProvider:
 *                       type: string
 *                       example: LOCAL
 *                     hasPassword:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Lỗi server
 */
router.get(
  '/employer/account',
  protect,
  authorize(UserRole.EMPLOYER),
  getMyEmployerLoginInfo
);
/**
 * @swagger
 * /api/employer/account/password:
 *   put:
 *     summary: Đổi mật khẩu employer đang đăng nhập
 *     description: Employer phải nhập mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.
 *     tags: [Employer Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 example: newPassword123
 *               confirmNewPassword:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu cũ sai hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Lỗi server
 */
router.put(
  '/employer/account/password',
  protect,
  authorize(UserRole.EMPLOYER),
  updateMyEmployerPassword
);

export default router;