import express from 'express';
import { getCareerGroups, 
  getCareers, 
  getCareerPositions,
  getSkillsByCareerGroup,
  getJobLevels,
  getExperienceLevels } from '../controllers/masterDataController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();
/**
 * @swagger
 * /api/master-data/career-groups:
 *   get:
 *     summary: Get all active career groups
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of career groups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/master-data/career-groups', getCareerGroups);

/**
 * @swagger
 * tags:
 *   name: Master Data
 *   description: Master data endpoints for career groups, careers, positions, levels and experience
 */


/**
 * @swagger
 * /api/master-data/careers:
 *   get:
 *     summary: Get all active careers, optional filter by careerGroupId
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: careerGroupId
 *         schema:
 *           type: string
 *         description: Career group id to filter careers
 *     responses:
 *       200:
 *         description: List of careers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/master-data/careers', getCareers);

/**
 * @swagger
 * /api/master-data/career-positions:
 *   get:
 *     summary: Get career positions, optional filter by careerGroupId or careerId
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: careerGroupId
 *         schema:
 *           type: string
 *         description: Career group id to filter positions
 *       - in: query
 *         name: careerId
 *         schema:
 *           type: string
 *         description: Career id to filter positions
 *     responses:
 *       200:
 *         description: List of career positions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/master-data/career-positions', getCareerPositions);

/**
 * @swagger
 * /api/master-data/job-levels:
 *   get:
 *     summary: Get active job levels, optional filter by careerGroupId
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: careerGroupId
 *         schema:
 *           type: string
 *         description: Career group id to filter job levels
 *     responses:
 *       200:
 *         description: List of job levels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/master-data/job-levels', getJobLevels);

/**
 * @swagger
 * /api/master-data/experience-levels:
 *   get:
 *     summary: Get all active experience levels
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of experience levels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/master-data/experience-levels', getExperienceLevels);


/**
 * @swagger
 * /api/career-groups/{careerGroupId}/skills:
 *   get:
 *     summary: Lấy danh sách kỹ năng theo nhóm ngành nghề
 *     description: Trả về tất cả kỹ năng (Skill) thuộc nhóm nghề (Career Group) và đang ở trạng thái ACTIVE
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: careerGroupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của nhóm ngành nghề (Career Group)
 *     responses:
 *       200:
 *         description: Lấy danh sách kỹ năng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       aliases:
 *                         type: array
 *                         items:
 *                           type: string
 *       400:
 *         description: Career Group ID không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get('/master-data/career-groups/:careerGroupId/skills', getSkillsByCareerGroup);
export default router;