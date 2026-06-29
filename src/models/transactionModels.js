import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import {
  PackageTargetType,
  PaymentMethod,
  TransactionStatus,
  TransactionType
} from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const transactionSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  walletId: { type: objectId, ref: 'Wallet', default: null },
  type: { type: String, enum: Object.values(TransactionType), required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  balanceBefore: { type: Number, default: null },
  balanceAfter: { type: Number, default: null },
  status: { type: String, enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING },
  paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
  paymentOrderId: { type: objectId, ref: 'PaymentOrder', default: null },
  packageId: { type: objectId, default: null }, // Mất ref, giờ dùng snapshot
  packageSnapshot: {
    id: { type: objectId, default: null },
    code: { type: String, default: null },
    name: { type: String, default: null },
    type: { type: String, default: null },
    price: { type: Number, default: null },
    durationDays: { type: Number, default: null }
  },
  targetType: { type: String, enum: Object.values(PackageTargetType), default: null },
  targetId: { type: objectId, default: null },
  description: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  invoiceRequested: { type: Boolean, default: false }
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema, 'transactions');
export default Transaction;
