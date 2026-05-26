// routes/companyMasterDataRoutes.js
import express from 'express';
import {
  getCompanyIndustries,
  getCompanySizes
} from '../controllers/companyMasterDataController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Company Master Data
 *   description: Company industry and size master data APIs
 */

/**
 * @swagger
 * /api/company-master-data/industries:
 *   get:
 *     summary: Lấy danh sách ngành công ty đang hoạt động
 *     tags: [Company Master Data]
 *     responses:
 *       200:
 *         description: Lấy danh sách ngành công ty thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 665f1d24e123456789abc111
 *                       name:
 *                         type: string
 *                         example: Công nghệ thông tin
 *                       slug:
 *                         type: string
 *                         example: cong-nghe-thong-tin
 *                       status:
 *                         type: string
 *                         example: ACTIVE
 *       500:
 *         description: Lỗi server
 */
router.get('/company-master-data/industries', getCompanyIndustries);

/**
 * @swagger
 * /api/company-master-data/sizes:
 *   get:
 *     summary: Lấy danh sách quy mô công ty đang hoạt động
 *     tags: [Company Master Data]
 *     responses:
 *       200:
 *         description: Lấy danh sách quy mô công ty thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 665f1d24e123456789abc222
 *                       code:
 *                         type: string
 *                         example: SIZE_1_10
 *                       name:
 *                         type: string
 *                         example: 1-10 nhân viên
 *                       minEmployees:
 *                         type: integer
 *                         example: 1
 *                       maxEmployees:
 *                         type: integer
 *                         nullable: true
 *                         example: 10
 *                       status:
 *                         type: string
 *                         example: ACTIVE
 *       500:
 *         description: Lỗi server
 */
router.get('/company-master-data/sizes', getCompanySizes);

export default router;