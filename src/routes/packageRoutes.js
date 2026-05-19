import express from 'express';
import { createPackage, updatePackage, updatePackageStatus, getPackages } from '../controllers/packageController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /admin/packages:
 *   post:
 *     summary: Create a new package
 *     tags: [Packages]
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
 *               - price
 *               - duration
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *               duration:
 *                 type: number
 *               jobPostsAllowed:
 *                 type: number
 *               featuredDays:
 *                 type: number
 *               cvAccessLimit:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               sortOrder:
 *                 type: number
 *     responses:
 *       201:
 *         description: Package created successfully
 */
router.post('/admin/packages', authorize(UserRole.ADMIN), createPackage);

/**
 * @swagger
 * /admin/packages/:id:
 *   put:
 *     summary: Update a package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *               duration:
 *                 type: number
 *               jobPostsAllowed:
 *                 type: number
 *               featuredDays:
 *                 type: number
 *               cvAccessLimit:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: number
 *     responses:
 *       200:
 *         description: Package updated successfully
 */
router.put('/admin/packages/:id', authorize(UserRole.ADMIN), updatePackage);

/**
 * @swagger
 * /admin/packages/:id/status:
 *   patch:
 *     summary: Update package status (active/inactive)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Package status updated successfully
 */
router.patch('/admin/packages/:id/status', authorize(UserRole.ADMIN), updatePackageStatus);

/**
 * @swagger
 * /packages:
 *   get:
 *     summary: Get all packages (public)
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of packages
 */
router.get('/packages', getPackages);

export default router;