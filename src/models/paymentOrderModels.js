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
  provider: { type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.PAYOS },
  orderCode: { type: Number, required: true, unique: true },
  payosPaymentLinkId: { type: String, default: null },
  payosCheckoutUrl: { type: String, default: null },
  payosQrCode: { type: String, default: null },
  returnUrl: { type: String, required: true },
  cancelUrl: { type: String, required: true },
  packageId: { type: objectId, ref: 'ServicePackage', default: null },
  targetType: { type: String, enum: Object.values(PackageTargetType), default: null },
  targetId: { type: objectId, default: null },
  status: { type: String, enum: Object.values(PaymentOrderStatus), default: PaymentOrderStatus.PENDING },
  paidAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  expiredAt: { type: Date, required: true },
  payosRawResponse: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema, 'payment_orders');
export default PaymentOrder;
