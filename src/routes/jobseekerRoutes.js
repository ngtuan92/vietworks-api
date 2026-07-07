import express from 'express';
import { getTransactions } from '../controllers/walletController.js';
import { requireJobseeker } from '../middlewares/authMiddleware.js';
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  updateJobPreferences,
  getJobPreferences,
  getMatchedJobs,
  saveJob,
  unsaveJob,
  getSavedJobs,
  getSimilarSavedJobs,
  followCompany,
  unfollowCompany,
  getFollowedCompanies,
  getPublicCompanies,
  getPublicCompanyDetail,
  getCompanyOpenJobs
} from '../controllers/jobseekerController.js';

const router = express.Router();

// Lịch sử giao dịch của ứng viên (mua Boost CV, AI Premium...)
router.get('/jobseeker/transactions', requireJobseeker, getTransactions);

// ─── PUBLIC (không cần auth) ───────────────────
/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Danh sách công ty đã xác minh
 *     tags: [Companies]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: Danh sách công ty
 */
router.get('/companies', getPublicCompanies);

/**
 * @swagger
 * /api/companies/{companyId}:
 *   get:
 *     summary: Chi tiết công ty (public)
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chi tiết công ty
 *       404:
 *         description: Không tìm thấy công ty
 */
router.get('/companies/:companyId', getPublicCompanyDetail);

/**
 * @swagger
 * /api/companies/{companyId}/jobs:
 *   get:
 *     summary: Danh sách job đang mở của một công ty
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách job đang tuyển của công ty
 */
router.get('/companies/:companyId/jobs', getCompanyOpenJobs);

/**
 * @swagger
 * /api/companies/{companyId}/jobs/search:
 *   get:
 *     summary: Tìm kiếm job trong trang chi tiết công ty theo keyword hoặc địa điểm
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm job của công ty
 */
router.get('/companies/:companyId/jobs/search', getCompanyOpenJobs);

// ─── JOBSEEKER (cần auth + role JOBSEEKER) ─────

/**
 * @swagger
 * /api/jobseeker/search-history:
 *   get:
 *     summary: Lấy lịch sử tìm kiếm của ứng viên
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách từ khóa đã tìm kiếm (mới nhất trước)
 */
router.get('/jobseeker/search-history', requireJobseeker, getSearchHistory);

/**
 * @swagger
 * /api/jobseeker/search-history:
 *   post:
 *     summary: Lưu từ khóa tìm kiếm vào lịch sử
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyword]
 *             properties:
 *               keyword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã lưu lịch sử
 */
router.post('/jobseeker/search-history', requireJobseeker, addSearchHistory);

/**
 * @swagger
 * /api/jobseeker/search-history:
 *   delete:
 *     summary: Xóa toàn bộ lịch sử tìm kiếm
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã xóa toàn bộ lịch sử
 */
router.delete('/jobseeker/search-history', requireJobseeker, clearSearchHistory);

/**
 * @swagger
 * /api/jobseeker/job-preferences:
 *   put:
 *     summary: Cập nhật nhu cầu việc làm (để hệ thống gợi ý job phù hợp)
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               careerGroupId: { type: string }
 *               careerId: { type: string }
 *               careerPositionId: { type: string }
 *               experience: { type: string }
 *               salaryMin: { type: number }
 *               salaryMax: { type: number }
 *               workLocations: { type: array }
 *               skills: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Đã cập nhật nhu cầu việc làm
 */
router.put('/jobseeker/job-preferences', requireJobseeker, updateJobPreferences);

/**
 * @swagger
 * /api/jobseeker/job-preferences:
 *   get:
 *     summary: Lấy nhu cầu việc làm đã lưu của ứng viên
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nhu cầu việc làm hiện tại
 */
router.get('/jobseeker/job-preferences', requireJobseeker, getJobPreferences);

/**
 * @swagger
 * /api/jobseeker/matched-jobs:
 *   get:
 *     summary: Danh sách việc làm phù hợp với nhu cầu của ứng viên
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: Danh sách việc làm phù hợp
 */
router.get('/jobseeker/matched-jobs', requireJobseeker, getMatchedJobs);

/**
 * @swagger
 * /api/jobseeker/saved-jobs/{jobId}:
 *   post:
 *     summary: Lưu việc làm (thả tim)
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Đã lưu việc làm
 *       400:
 *         description: Đã lưu trước đó
 */
router.post('/jobseeker/saved-jobs/:jobId', requireJobseeker, saveJob);

/**
 * @swagger
 * /api/jobseeker/saved-jobs/{jobId}:
 *   delete:
 *     summary: Bỏ lưu việc làm
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Đã bỏ lưu
 */
router.delete('/jobseeker/saved-jobs/:jobId', requireJobseeker, unsaveJob);

/**
 * @swagger
 * /api/jobseeker/saved-jobs:
 *   get:
 *     summary: Danh sách việc làm đã lưu
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách job đã lưu
 */
router.get('/jobseeker/saved-jobs', requireJobseeker, getSavedJobs);

/**
 * @swagger
 * /api/jobseeker/saved-jobs/similar:
 *   get:
 *     summary: Gợi ý việc làm tương tự dựa trên job đã lưu
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6 }
 *     responses:
 *       200:
 *         description: Danh sách việc làm tương tự
 */
router.get('/jobseeker/saved-jobs/similar', requireJobseeker, getSimilarSavedJobs);

/**
 * @swagger
 * /api/jobseeker/followed-companies/{companyId}:
 *   post:
 *     summary: Theo dõi công ty
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Đã theo dõi công ty
 */
router.post('/jobseeker/followed-companies/:companyId', requireJobseeker, followCompany);

/**
 * @swagger
 * /api/jobseeker/followed-companies/{companyId}:
 *   delete:
 *     summary: Bỏ theo dõi công ty
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Đã bỏ theo dõi
 */
router.delete('/jobseeker/followed-companies/:companyId', requireJobseeker, unfollowCompany);

/**
 * @swagger
 * /api/jobseeker/followed-companies:
 *   get:
 *     summary: Danh sách công ty đang theo dõi
 *     tags: [Jobseeker]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách công ty đã follow
 */
router.get('/jobseeker/followed-companies', requireJobseeker, getFollowedCompanies);

export default router;
