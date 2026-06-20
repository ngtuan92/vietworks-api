import ServicePackage from '../models/servicePackageModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import Wallet from '../models/walletModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import { ServicePackageType, ServicePackageTargetRole, TransactionType, TransactionStatus, PaymentMethod } from '../enums/paymentEnums.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';

export const getBoostPackages = async (req, res) => {
  try {
    const packages = await ServicePackage.find({
      packageType: ServicePackageType.CV_BOOST,
      targetRole: ServicePackageTargetRole.JOBSEEKER,
      status: 'ACTIVE'
    }).sort({ price: 1 });

    res.status(200).json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBoostPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cvId } = req.params;
    const { packageId } = req.body;

    const cv = await UploadedCV.findOne({ _id: cvId, userId });
    if (!cv) {
      return res.status(404).json({ success: false, message: 'CV not found or not owned by user' });
    }

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg || pkg.packageType !== ServicePackageType.CV_BOOST) {
      return res.status(400).json({ success: false, message: 'Invalid package' });
    }

    const transaction = await Transaction.create({
      userId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: pkg.price,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: 'CV',
      targetId: cvId,
      packageId,
      description: `Boost CV ${cv.title} - ${pkg.name}`
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

export const activateCvBoost = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
      return res.status(400).json({ success: false, message: 'Invalid transaction' });
    }

    if (transaction.type !== TransactionType.PACKAGE_PURCHASE || transaction.targetType !== 'CV') {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const existing = await CvBoost.findOne({ cvId: transaction.targetId, status: 'ACTIVE' });
    if (existing) {
      return res.status(200).json({ success: true, message: 'CV already boosted', data: existing });
    }

    const pkg = await ServicePackage.findById(transaction.packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Package not found' });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

    const cvBoost = await CvBoost.create({
      cvId: transaction.targetId,
      userId: transaction.userId,
      packageId: pkg._id,
      startAt,
      endAt
    });

    res.status(201).json({ success: true, data: cvBoost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};