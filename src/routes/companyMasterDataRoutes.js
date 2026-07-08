// routes/companyMasterDataRoutes.js
import express from 'express';
import {
  getCompanyIndustries,
  createCompanyIndustry,
  updateCompanyIndustry,
  deleteCompanyIndustry
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

router.post('/admin/company-master-data/industries', createCompanyIndustry);
router.put('/admin/company-master-data/industries/:id', updateCompanyIndustry);
router.delete('/admin/company-master-data/industries/:id', deleteCompanyIndustry);



export default router;