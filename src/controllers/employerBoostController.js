import ServicePackage from '../models/servicePackageModels.js';
import Transaction from '../models/transactionModels.js';
import JobBoost from '../models/jobBoostModels.js';
import Wallet from '../models/walletModels.js';
import Job from '../models/jobModels.js';
import { ServicePackageType, ServicePackageTargetRole, TransactionType, TransactionStatus, PaymentMethod } from '../enums/paymentEnums.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';

export const createBoostPayment = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { jobId } = req.params;
    const { packageId } = req.body;

    const job = await Job.findOne({ _id: jobId, employerId, status: 'PUBLISHED' });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or not owned' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (new Date(job.deadline) < startOfToday) {
      return res.status(400).json({ success: false, message: 'Job deadline has passed' });
    }

    const existing = await JobBoost.findOne({ jobId, status: 'ACTIVE' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Job already boosted' });
    }

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg || pkg.packageType !== ServicePackageType.PREMIUM_JOB) {
      return res.status(400).json({ success: false, message: 'Invalid package' });
    }

    const transaction = await Transaction.create({
      userId: employerId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: pkg.price,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: 'JOB',
      targetId: jobId,
      packageId,
      description: `Boost Job ${job.title} - ${pkg.name}`
    });

    const orderCode = generateOrderCode(transaction._id.toString());
    transaction.metadata = { orderCode };
    await transaction.save();

    const bankAccount = process.env.SEPAY_BANK_ACCOUNT || '1017588888';
    const bankName = process.env.SEPAY_BANK_NAME || 'Vietcombank';
    const qrUrl = createQRPaymentUrl({
      account: bankAccount,
      bank: bankName,
      amount: pkg.price,
      orderCode
    });
    const transferContent = buildTransferContent(orderCode);

    res.status(200).json({
      success: true,
      data: {
        transactionId: transaction._id,
        orderCode,
        amount: pkg.price,
        qrUrl,
        transferContent,
        bankAccount,
        bankName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateJobBoost = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
      return res.status(400).json({ success: false, message: 'Invalid transaction' });
    }

    if (transaction.type !== TransactionType.PACKAGE_PURCHASE || transaction.targetType !== 'JOB') {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const existing = await JobBoost.findOne({ jobId: transaction.targetId, status: 'ACTIVE' });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Job already boosted', data: existing });
    }

    const pkg = await ServicePackage.findById(transaction.packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Package not found' });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

    const jobBoost = await JobBoost.create({
      jobId: transaction.targetId,
      employerId: transaction.userId,
      packageId: pkg._id,
      startAt,
      endAt
    });

    res.status(201).json({ success: true, data: jobBoost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveJobBoosts = async (req, res) => {
  try {
    const employerId = req.user._id;

    const boosts = await JobBoost.find({ employerId, status: 'ACTIVE' })
      .populate('jobId', 'title deadline')
      .populate('packageId', 'name durationDays price')
      .sort({ startAt: -1 });

    res.status(200).json({ success: true, data: boosts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};