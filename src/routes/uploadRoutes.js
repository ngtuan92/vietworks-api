// routes/uploadRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import { upload } from '../utils/cloudinary.js'
import { uploadCompanyImage } from '../controllers/uploadController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: File upload APIs
 */

/**
 * @swagger
 * /api/uploads/company-image:
 *   post:
 *     summary: Upload ảnh logo hoặc ảnh bìa công ty lên Cloudinary
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload ảnh thành công
 *       400:
 *         description: Chưa upload file hoặc file không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Upload thất bại
 */
router.post(
  '/uploads/company-image',
  protect,
  authorize(UserRole.EMPLOYER),
  upload.single('file'),
  uploadCompanyImage
);

export default router;