import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const sepayWebhookLogSchema = new mongoose.Schema({
  orderCode: { type: String, required: true },
  paymentOrderId: { type: objectId, default: null },
  transactionId: { type: String, required: true },
  transferAmount: { type: Number, required: true },
  transferType: { type: String, required: true },
  transactionDate: { type: Date, default: null },
  gateway: { type: String, default: null },
  accountNumber: { type: String, default: null },
  subAccount: { type: String, default: null },
  content: { type: String, default: null },
  referenceCode: { type: String, default: null },
  accumulated: { type: Number, default: null },
  signature: { type: String, required: true },
  isVerifiedSignature: { type: Boolean, default: false },
  processed: { type: Boolean, default: false },
  processedAt: { type: Date, default: null },
  errorMessage: { type: String, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

const SepayWebhookLog = mongoose.model('SepayWebhookLog', sepayWebhookLogSchema, 'sepay_webhook_logs');
export default SepayWebhookLog;
