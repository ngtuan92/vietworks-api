// routes/uploadRoutes.js
import express from 'express';
import multer from 'multer';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';
import { upload } from '../utils/cloudinary.js'
import { uploadCompanyImage, uploadAvatarImage } from '../controllers/uploadController.js';

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File tải lên vượt quá giới hạn 10MB.'
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Lỗi tải file'
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File không hợp lệ'
    });
  }

  next();
};

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
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      return uploadCompanyImage(req, res, next);
    });
  }
);

/**
 * @swagger
 * /api/uploads/avatar:
 *   post:
 *     summary: Upload ảnh đại diện lên Cloudinary cho ứng viên hoặc admin
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
 *       500:
 *         description: Upload thất bại
 */
router.post(
  '/uploads/avatar',
  protect,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      return uploadAvatarImage(req, res, next);
    });
  }
);

router.post(
  '/uploads/chat-file',
  protect,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      import('../controllers/uploadController.js').then(ctrl => ctrl.uploadChatFile(req, res, next));
    });
  }
);

export default router;