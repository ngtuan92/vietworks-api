import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './configs/swagger.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend đang hoạt động' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

import authRoutes from './routes/authRoutes.js';
import cvTemplateRoutes from './routes/cvTemplateRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import masterDataRoutes from './routes/masterDataRoutes.js';
import companyLocationRoutes from './routes/companyLocationRoutes.js';
import companyMasterData from './routes/companyMasterDataRoutes.js';
import employerCompanyRoutes from './routes/employerCompanyRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import employerAccountRoutes from './routes/employerAccountRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import cvRoutes from './routes/cvRoutes.js';
import uploadedCvRoutes from './routes/uploadedCvRoutes.js';
import jobAdminRoutes from './routes/jobAdminRoutes.js';
import aiCvReviewRoutes from './routes/aiCvReviewRoutes.js';
import adminCompanyVerificationRoutes from './routes/adminCompanyVerificationRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import jobseekerProfileRoutes from './routes/jobseekerProfileRoutes.js';
import jobseekerRoutes from './routes/jobseekerRoutes.js';
// Public & Static Routes
app.use('/api', addressRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/cv-templates', cvTemplateRoutes);
app.use('/api', jobRoutes);
app.use('/api', masterDataRoutes);
app.use('/api', companyLocationRoutes);
app.use('/api', companyMasterData);

// Protected & Specific Routes
app.use('/api', employerAccountRoutes);
app.use('/api', employerCompanyRoutes);
app.use('/api', packageRoutes);
app.use('/api', walletRoutes);
app.use('/api', adminRoutes);
app.use('/api', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cvs', cvRoutes);
app.use('/api/jobseeker/cvs', uploadedCvRoutes);
app.use('/api', jobAdminRoutes);
app.use('/api', uploadRoutes);

app.use('/api/ai-cv-reviews', aiCvReviewRoutes);
app.use('/api', adminCompanyVerificationRoutes);
app.use('/api', jobseekerProfileRoutes);
app.use('/api', jobseekerRoutes);
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: 'Server error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

export default app;
