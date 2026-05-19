import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const payosWebhookLogSchema = new mongoose.Schema({
  orderCode: { type: Number, required: true },
  paymentOrderId: { type: objectId, ref: 'PaymentOrder', default: null },
  code: { type: String, required: true },
  desc: { type: String, required: true },
  success: { type: Boolean, required: true },
  signature: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  isVerifiedSignature: { type: Boolean, default: false },
  processed: { type: Boolean, default: false },
  processedAt: { type: Date, default: null },
  errorMessage: { type: String, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

const PayosWebhookLog = mongoose.model('PayosWebhookLog', payosWebhookLogSchema, 'payos_webhook_logs');
export default PayosWebhookLog;
