import Transaction from '../models/Transaction.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';

export const requestInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { taxId, address } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Transaction must be successful' });
    }

    if (transaction.type !== 'PAYMENT') {
      return res.status(400).json({ success: false, message: 'Only payment transactions can request invoice' });
    }

    const existingInvoice = await Invoice.findOne({ transactionId: id });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'Invoice already requested' });
    }

    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInvoiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!['PENDING', 'GENERATED', 'SENT', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    invoice.status = status;
    if (status === 'SENT') {
      invoice.sentAt = new Date();
    }

    await invoice.save();
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};