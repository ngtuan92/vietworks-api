import express from 'express';
import jobAdminController from '../controllers/jobAdminController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Job Admin
 *   description: API Quản trị công việc (Yêu cầu quyền ADMIN hoặc MANAGER)
 */

// ==========================================
// 1. ROUTE LẤY DANH SÁCH CÔNG VIỆC CHỜ DUYỆT
// ==========================================
/**
 * @swagger
 * /api/admin/jobs/pending:
 *   get:
 *     summary: Lấy danh sách công việc đang chờ duyệt
 *     tags: [Job Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item trên một trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm theo tiêu đề công việc
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa đăng nhập (Unauthorized)
 *       403:
 *         description: Không có quyền ADMIN/MANAGER (Forbidden)
 */
router.get(
  '/admin/jobs/pending',
  protect,
  authorize('ADMIN'),
  jobAdminController.getAllJobsPending
);

// ==========================================
// 2. ROUTE LẤY CHI TIẾT CÔNG VIỆC
// ==========================================
/**
 * @swagger
 * /api/admin/jobs/{jobId}:
 *   get:
 *     summary: Lấy chi tiết một công việc theo ID
 *     tags: [Job Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *       404:
 *         description: Không tìm thấy công việc
 */
router.get(
  '/admin/jobs/:jobId',
  protect,
  authorize('ADMIN'),
  jobAdminController.getJobById
);

// ==========================================
// 3. ROUTE DUYỆT CÔNG VIỆC
// ==========================================
/**
 * @swagger
 * /api/admin/jobs/{jobId}/approve:
 *   patch:
 *     summary: Duyệt công việc
 *     tags: [Job Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc cần duyệt
 *     responses:
 *       200:
 *         description: Duyệt công việc thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.patch(
  '/admin/jobs/:jobId/approve',
  protect,
  authorize('ADMIN'),
  jobAdminController.approveJob
);

// ==========================================
// 4. ROUTE TỪ CHỐI DUYỆT CÔNG VIỆC
// ==========================================
/**
 * @swagger
 * /api/admin/jobs/{jobId}/reject:
 *   patch:
 *     summary: Từ chối duyệt công việc
 *     tags: [Job Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc bị từ chối
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Thông tin tuyển dụng không rõ ràng hoặc vi phạm chính sách."
 *     responses:
 *       200:
 *         description: Từ chối thành công
 */
router.patch(
  '/admin/jobs/:jobId/reject',
  protect,
  authorize('ADMIN'),
  jobAdminController.rejectJob
);

// ==========================================
// 5. ROUTE BAN (KHÓA) CÔNG VIỆC
// ==========================================
/**
 * @swagger
 * /api/admin/jobs/{jobId}/ban:
 *   patch:
 *     summary: Khóa công việc vi phạm
 *     tags: [Job Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc cần khóa
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Công việc có dấu hiệu lừa đảo."
 *     responses:
 *       200:
 *         description: Khóa công việc thành công
 */
router.patch(
  '/admin/jobs/:jobId/ban',
  protect,
  authorize('ADMIN'),
  jobAdminController.banJob
);

export default router;