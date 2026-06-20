import Transaction from '../models/transactionModels.js';
import Invoice from '../models/Invoice.js';
import User from '../models/userModels.js';
import { TransactionType } from '../enums/paymentEnums.js';

export const requestInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { taxId, address } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    if (transaction.status !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Giao dịch phải ở trạng thái thành công' });
    }

    if (transaction.type !== TransactionType.PACKAGE_PURCHASE) {
      return res.status(400).json({ success: false, message: 'Chỉ giao dịch thanh toán mới có thể yêu cầu xuất hóa đơn' });
    }

    const existingInvoice = await Invoice.findOne({ transactionId: id });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'Hóa đơn đã được yêu cầu trước đó' });
    }

    if (transaction.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to request invoice for this transaction' });
    }

    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const invoice = await Invoice.create({
      transactionId: id,
      invoiceNumber,
      buyerName: user.fullName,
      buyerEmail: user.email,
      buyerTaxId: taxId || null,
      buyerAddress: address || null,
      amount: transaction.amount,
      currency: transaction.currency || 'VND',
      status: 'PENDING'
    });

    transaction.invoiceRequested = true;
    await transaction.save();

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
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

