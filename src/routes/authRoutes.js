import express from 'express';
import {
  registerJobseeker,
  registerEmployer,
  verifyEmployerOtp,
  resendEmployerOtp,
  forgotPassword,
  resetPassword,
  login,
  loginEmployer,
  loginJobseeker,
  refreshToken,
  logout,
  googleLogin,
  linkedinLogin,
  googleLoginJobseeker,
  googleLoginEmployer,
  linkedinLoginJobseeker,
  linkedinLoginEmployer
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

/**
 * @swagger
 * /api/auth/register/jobseeker:
 *   post:
 *     summary: Register a new jobseeker
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Jobseeker registered successfully
 *       400:
 *         description: User already exists / validation error
 */
router.post('/register/jobseeker', registerJobseeker);

/**
 * @swagger
 * /api/auth/register/employer:
 *   post:
 *     summary: Register a new employer with company profile
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *               - phone
 *               - representativeName
 *               - gender
 *               - company
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               representativeName:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               company:
 *                 type: object
 *                 required: [name, taxCode, industryId, sizeId, email, phone, description]
 *                 properties:
 *                   name: { type: string }
 *                   taxCode: { type: string }
 *                   industryId: { type: string }
 *                   sizeId: { type: string }
 *                   email: { type: string, format: email }
 *                   phone: { type: string }
 *                   website: { type: string }
 *                   description: { type: string }
 *     responses:
 *       201:
 *         description: Employer registered successfully and OTP sent to email
 *       400:
 *         description: Validation error or duplicate data
 */
router.post('/register/employer', registerEmployer);

/**
 * @swagger
 * /api/auth/register/employer/verify-otp:
 *   post:
 *     summary: Verify employer email with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified and employer account activated
 *       400:
 *         description: Invalid/expired OTP or bad request
 */
router.post('/register/employer/verify-otp', verifyEmployerOtp);

/**
 * @swagger
 * /api/auth/register/employer/resend-otp:
 *   post:
 *     summary: Resend OTP for employer verification (cooldown 60s)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       429:
 *         description: Too many requests, wait cooldown time
 */
router.post('/register/employer/resend-otp', resendEmployerOtp);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password', resetPassword);

router.post('/login', login);
router.post('/login/jobseeker', loginJobseeker);
router.post('/login/employer', loginEmployer);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: New access token generated
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login with Google
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *             properties:
 *               tokenId:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Google login successful
 */
router.post('/google', googleLogin);
router.post('/google/jobseeker', googleLoginJobseeker);
router.post('/google/employer', googleLoginEmployer);

/**
 * @swagger
 * /api/auth/linkedin:
 *   post:
 *     summary: Login with LinkedIn
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: LinkedIn login successful
 */
router.post('/linkedin', linkedinLogin);
router.post('/linkedin/jobseeker', linkedinLoginJobseeker);
router.post('/linkedin/employer', linkedinLoginEmployer);

export default router;

