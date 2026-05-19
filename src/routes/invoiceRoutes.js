import express from 'express';
import { getInvoiceRequests, updateInvoiceRequest } from '../controllers/invoiceController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.get('/admin/invoice-requests', protect, authorize(UserRole.ADMIN), getInvoiceRequests);
router.patch('/admin/invoice-requests/:id', protect, authorize(UserRole.ADMIN), updateInvoiceRequest);

export default router;