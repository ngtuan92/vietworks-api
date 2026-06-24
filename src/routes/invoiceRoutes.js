import express from 'express';
import { requestInvoice, getInvoiceRequests, updateInvoiceRequest } from '../controllers/invoiceController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

// Employer / Jobseeker: yêu cầu xuất hóa đơn cho 1 giao dịch PACKAGE_PURCHASE thành công.
// Controller đã tự check req.user._id === transaction.userId (chỉ chủ GD mới xin được).
router.post('/transactions/:id/invoice', protect, requestInvoice);

router.get('/admin/invoice-requests', protect, authorize(UserRole.ADMIN), getInvoiceRequests);
router.patch('/admin/invoice-requests/:id', protect, authorize(UserRole.ADMIN), updateInvoiceRequest);

export default router;