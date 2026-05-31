import express from 'express';
import {
  createJob,
  updateJob,
  publishJob,
  deleteJob,
  getMyJobs,
  getJobById,
  getJobs,
  submitJobForReview,
  closeJob
} from '../controllers/jobController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { getApplyOptions } from '../controllers/applyController.js';
import { applyJob } from '../controllers/applyController.js';
import { getApplyCvPreview } from '../controllers/applyController.js';
import { checkDuplicateApplication } from '../controllers/applyController.js';


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job management for employers and jobseekers
 */

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job (draft)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - careerGroupId
 *               - careerId
 *               - careerPositionId
 *               - jobLevelId
 *               - experienceLevelId
 *               - description
 *               - requirements
 *               - benefits
 *               - workingTime
 *               - applyInstruction
 *               - deadline
 *             properties:
 *               title:
 *                 type: string
 *               careerGroupId:
 *                 type: string
 *               careerId:
 *                 type: string
 *               careerPositionId:
 *                 type: string
 *               jobLevelId:
 *                 type: string
 *               experienceLevelId:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               salary:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [RANGE, NEGOTIABLE]
 *                   minMillion:
 *                     type: number
 *                   maxMillion:
 *                     type: number
 *                   currency:
 *                     type: string
 *               workLocations:
 *                 type: array
 *               saturdayPolicy:
 *                 type: string
 *                 enum: [NOT_SPECIFIED, WORKING_SATURDAY, OFF_SATURDAY]
 *               description:
 *                 type: string
 *               requirements:
 *                 type: string
 *               benefits:
 *                 type: string
 *               workingTime:
 *                 type: string
 *               applyInstruction:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               isUrgent:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Job created successfully
 */
router.post('/jobs', protect, authorize('EMPLOYER'), createJob);

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   patch:
 *     summary: Update a job (only in draft status)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Job updated successfully
 */
router.patch('/jobs/:jobId', protect, authorize('EMPLOYER'), updateJob);

/**
 * @swagger
 * /api/jobs/{jobId}/publish:
 *   post:
 *     summary: Publish a job (submit for approval)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job submitted for approval
 */
router.post('/jobs/:jobId/publish', protect, authorize('EMPLOYER'), publishJob);
/**
 * @swagger
 * /api/jobs/{jobId}/submit:
 *   post:
 *     summary: Nộp tin tuyển dụng chờ xét duyệt (DRAFT → PENDING)
 *     description: Chuyển job từ trạng thái Draft sang Pending để admin duyệt
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tin tuyển dụng
 *     responses:
 *       200:
 *         description: Job submitted successfully
 *       400:
 *         description: Invalid request or job is not in DRAFT status
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Job not found
 */
router.post('/jobs/:jobId/submit', protect, authorize('EMPLOYER'), submitJobForReview);




/**
 * @swagger
 * /api/jobs/{jobId}:
 *   delete:
 *     summary: Delete a job (only in draft status)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deleted successfully
 */
router.delete('/jobs/:jobId', protect, authorize('EMPLOYER'), deleteJob);

/**
 * @swagger
 * /api/employer/jobs:
 *   get:
 *     summary: Get all jobs created by employer
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 */
router.get('/employer/jobs', protect, authorize('EMPLOYER'), getMyJobs);

/**
 * @swagger
 * /api/jobs/{jobId}/close:
 *   post:
 *     summary: Close a published job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job closed successfully
 */
router.post('/jobs/:jobId/close', protect, authorize('EMPLOYER'), closeJob);

/**
 * @swagger
 * /api/jobs/{jobId}/apply-options:
 *   get:
 *     summary: Lấy options để ứng tuyển (danh sách CV, địa điểm, thỏa thuận)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Apply options retrieved successfully
 */
router.get('/jobs/:jobId/apply-options', protect, getApplyOptions);

/**
 * @swagger
 * /api/jobs/{jobId}/apply/check:
 *   get:
 *     summary: Kiểm tra ứng viên đã ứng tuyển job này chưa
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check result returned successfully
 */
router.get('/jobs/:jobId/apply/check', protect, checkDuplicateApplication);

/**
 * @swagger
 * /api/jobs/{jobId}/apply:
 *   post:
 *     summary: Ứng tuyển vào job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cvId:
 *                 type: string
 *                 description: ID của CV online
 *               uploadedCvId:
 *                 type: string
 *                 description: ID của CV upload
 *               expectedWorkLocation:
 *                 type: object
 *                 description: Địa điểm mong muốn
 *               personalDataAgreementAccepted:
 *                 type: boolean
 *                 description: Đồng ý thỏa thuận dữ liệu cá nhân
 *     responses:
 *       201:
 *         description: Ứng tuyển thành công
 */
router.post('/jobs/:jobId/apply', protect, applyJob);

/**
 * @swagger
 * /api/jobs/{jobId}/apply/cv-preview/{cvId}:
 *   get:
 *     summary: Preview CV when applying
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: cvId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CV preview data retrieved
 */
router.get('/jobs/:jobId/apply/cv-preview/:cvId', protect, getApplyCvPreview);



/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job retrieved successfully
 */
router.get('/jobs/:jobId', getJobById);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all published jobs (with filters)
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: careerGroupId
 *         schema:
 *           type: string
 *       - in: query
 *         name: careerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: jobLevelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: experienceLevelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: salaryMin
 *         schema:
 *           type: number
 *       - in: query
 *         name: salaryMax
 *         schema:
 *           type: number
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 */
router.get('/jobs', getJobs);

export default router;
