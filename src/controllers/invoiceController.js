import Transaction from '../models/transactionModels.js';
import Invoice from '../models/Invoice.js';
import User from '../models/userModels.js';
import { TransactionType } from '../enums/paymentEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode, NotificationChannel } from '../enums/notificationEnums.js';
import { UserRole } from '../enums/userEnums.js';

export const requestInvoice = async (req, res) => {
  return res.status(410).json({ 
    success: false, 
    message: 'API này đã bị vô hiệu hóa. Người dùng có thể tự tải phiếu thu trực tiếp trên trình duyệt.' 
  });
};

export const getInvoiceRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .populate({
        path: 'transactionId',
        populate: { path: 'userId', select: 'fullName email' }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updateInvoiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    if (!['PENDING', 'GENERATED', 'SENT', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    invoice.status = status;
    if (status === 'SENT') {
      invoice.sentAt = new Date();
    }

    await invoice.save();
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

