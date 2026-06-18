import express from 'express';
import { getSalaryLookupOptions, getSalaryLookup } from '../controllers/salaryController.js';

const router = express.Router();

/**
 * @swagger
 * /api/tools/salary-lookup/options:
 *   get:
 *     summary: Lấy các lựa chọn cho công cụ tra cứu lương
 *     tags: [Tools]
 *     responses:
 *       200:
 *         description: Danh sách nhóm nghề, nghề, vị trí, mức kinh nghiệm
 */
router.get('/tools/salary-lookup/options', getSalaryLookupOptions);

/**
 * @swagger
 * /api/tools/salary-lookup:
 *   get:
 *     summary: Tra cứu lương trung bình theo vị trí, kinh nghiệm và địa điểm
 *     tags: [Tools]
 *     parameters:
 *       - in: query
 *         name: careerGroupId
 *         schema: { type: string }
 *       - in: query
 *         name: careerId
 *         schema: { type: string }
 *       - in: query
 *         name: careerPositionId
 *         schema: { type: string }
 *       - in: query
 *         name: experienceLevelId
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thống kê lương trung bình
 */
router.get('/tools/salary-lookup', getSalaryLookup);

export default router;
