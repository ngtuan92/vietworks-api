import mongoose from 'mongoose';
import { Currency } from '../enums/masterDataEnums.js';
import {
  PackageTargetType,
  PaymentOrderPurpose,
  PaymentOrderStatus,
  PaymentProvider
} from '../enums/paymentEnums.js';
import { objectId } from './sharedModels.js';

const paymentOrderSchema = new mongoose.Schema({
  userId: { type: objectId, ref: 'User', required: true },
  walletId: { type: objectId, ref: 'Wallet', default: null },
  purpose: { type: String, enum: Object.values(PaymentOrderPurpose), required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: Object.values(Currency), default: Currency.VND },
  provider: { type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.SEPAY },
  orderCode: { type: String, required: true, unique: true },
  sepayTransactionId: { type: String, default: null },
  sepayReferenceCode: { type: String, default: null },
  returnUrl: { type: String, required: true },
  cancelUrl: { type: String, required: true },
  packageId: { type: objectId, default: null }, // Removed ref
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
  status: { type: String, enum: Object.values(PaymentOrderStatus), default: PaymentOrderStatus.PENDING },
  paidAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  expiredAt: { type: Date, required: true },
  sepayRawResponse: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema, 'payment_orders');
export default PaymentOrder;
