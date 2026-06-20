// Phần 2 — Ví Employer + SePay (phần lõi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Wallet from '../src/models/walletModels.js';
import Transaction from '../src/models/transactionModels.js';
import { deposit, sepayWebhook } from '../src/controllers/walletController.js';
import { generateOrderCode } from '../src/services/sepayService.js';
import { TransactionType, TransactionStatus } from '../src/enums/paymentEnums.js';
import { mockRes, tick } from './helpers.js';

// Không set secret -> verifySepayWebhook bỏ qua, để test thẳng luồng nghiệp vụ
delete process.env.SEPAY_WEBHOOK_SECRET;

test('deposit: từ chối số tiền <= 0', async () => {
  const req = { user: { _id: 'U1' }, body: { amount: 0 } };
  const res = mockRes();
  await deposit(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('deposit: tạo giao dịch PENDING + trả orderCode (SEVN...) và QR', async () => {
  const _id = new mongoose.Types.ObjectId();
  let createArg;
  Wallet.findOne = async () => ({ userId: 'U1', balance: 0 });
  Transaction.create = async (doc) => { createArg = doc; return { ...doc, _id, metadata: {}, save: async () => {} }; };

  const req = { user: { _id: 'U1' }, body: { amount: 500000 } };
  const res = mockRes();
  await deposit(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createArg.type, TransactionType.WALLET_DEPOSIT);
  assert.equal(createArg.status, TransactionStatus.PENDING);
  assert.equal(res.body.data.amount, 500000);
  assert.match(res.body.data.orderCode, /^SEVN/);
  assert.match(res.body.data.qrUrl, /qr\.sepay\.vn/);
});

test('webhook: tra cứu giao dịch bằng orderCode đã lưu (không dựng lại _id bị cắt)', async () => {
  const _id = new mongoose.Types.ObjectId();
  const orderCode = generateOrderCode(_id.toString());
  const txn = {
    _id, userId: new mongoose.Types.ObjectId(), amount: 500000,
    status: 'PENDING', type: TransactionType.WALLET_DEPOSIT, metadata: { orderCode }
  };

  let lookupQuery = null;
  Transaction.findOne = async (q) => {
    if (q['metadata.sepayTransactionId']) return null; // bước dedup
    lookupQuery = q;                                    // bước tra cứu chính
    return txn;
  };
  Transaction.findOneAndUpdate = async () => ({ ...txn, status: 'SUCCESS' });
  Wallet.findOneAndUpdate = async () => ({});

  const body = {
    id: 'sepay-2', code: orderCode, transferAmount: 500000,
    transferType: 'in', transactionDate: '2026-06-19', referenceCode: 'REF2'
  };
  sepayWebhook({ body, headers: {} }, mockRes());
  await tick();

  assert.ok(lookupQuery, 'Webhook phải gọi findOne để tra cứu theo orderCode (không dùng findById _id bị cắt)');
  assert.equal(lookupQuery['metadata.orderCode'], orderCode);
});

test('webhook: gọi trùng 2 lần CHỈ cộng tiền 1 lần (idempotent)', async () => {
  const _id = new mongoose.Types.ObjectId();
  const orderCode = generateOrderCode(_id.toString());
  const txn = {
    _id,
    userId: new mongoose.Types.ObjectId(),
    amount: 500000,
    status: 'PENDING',
    type: TransactionType.WALLET_DEPOSIT,
    metadata: { orderCode }
  };

  let creditCalls = 0;
  let flipped = false;

  // dedup theo sepayTransactionId trả null (mô phỏng 2 webhook đồng thời);
  // lookup theo orderCode/_id trả txn
  Transaction.findOne = async (q) => (q['metadata.sepayTransactionId'] ? null : txn);
  Transaction.findById = async () => txn;
  // bước chuyển trạng thái nguyên tử: lần 1 flip thành công, lần 2 trả null (đã xử lý)
  Transaction.findOneAndUpdate = async () => {
    if (flipped) return null;
    flipped = true;
    return { ...txn, status: 'SUCCESS' };
  };
  Wallet.findOneAndUpdate = async () => { creditCalls++; return {}; };

  const body = {
    id: 'sepay-1', code: orderCode, transferAmount: 500000,
    transferType: 'in', transactionDate: '2026-06-19', referenceCode: 'REF1'
  };

  sepayWebhook({ body, headers: {} }, mockRes());
  await tick();
  sepayWebhook({ body, headers: {} }, mockRes());
  await tick();

  assert.equal(creditCalls, 1, 'Ví phải chỉ được cộng đúng 1 lần dù webhook đến 2 lần');
});
