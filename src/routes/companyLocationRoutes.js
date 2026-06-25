// routes/companyLocationRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import {
  createMyCompanyLocation,
  getMyCompanyLocations,
  updateMyCompanyLocation,
  deleteMyCompanyLocation
} from '../controllers/companyLocationController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Company Locations
 *   description: Employer company location APIs
 */

/**
 * @swagger
 * /api/employer/company/locations:
 *   get:
 *     summary: Lấy danh sách địa điểm làm việc của công ty employer đang sở hữu
 *     tags: [Company Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách địa điểm thành công
 *       400:
 *         description: Employer chưa có công ty
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
  '/employer/company/locations',
  protect,
  authorize(UserRole.EMPLOYER),
  getMyCompanyLocations
);

/**
 * @swagger
 * /employer/company/locations:
 *   post:
 *     summary: Employer tạo địa điểm chi nhánh mới cho công ty của mình
 *     tags: [Company Locations]
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
 *               - addressLine
 *               - province
 *             properties:
 *               name:
 *                 type: string
 *                 example: Chi nhánh Hà Nội
 *               addressLine:
 *                 type: string
 *                 example: Tầng 8, 123 Cầu Giấy
 *               province:
 *                 type: string
 *                 example: Hà Nội
 *               district:
 *                 type: string
 *                 nullable: true
 *                 example: Hà Đông
 *               ward:
 *                 type: string
 *                 nullable: true
 *                 example: Dương Nội
 *               latitude:
 *                 type: number
 *                 nullable: true
 *                 example: 20.987
 *               longitude:
 *                 type: number
 *                 nullable: true
 *                 example: 105.751
 *               isPrimary:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Tạo địa điểm công ty thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc employer chưa có công ty
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hồ sơ employer
 *       500:
 *         description: Lỗi server
 */
router.post(
  '/employer/company/locations',
  protect,
  authorize(UserRole.EMPLOYER),
  createMyCompanyLocation
);

router.put(
  '/employer/company/locations/:id',
  protect,
  authorize(UserRole.EMPLOYER),
  updateMyCompanyLocation
);

router.delete(
  '/employer/company/locations/:id',
  protect,
  authorize(UserRole.EMPLOYER),
  deleteMyCompanyLocation
);

export default router;