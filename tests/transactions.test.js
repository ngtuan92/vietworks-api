// Phần 3 — Lịch sử giao dịch (Employer + Jobseeker dùng chung getTransactions)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import Transaction from '../src/models/transactionModels.js';
import { getTransactions } from '../src/controllers/walletController.js';
import { mockRes, chainResolving } from './helpers.js';

test('getTransactions: chỉ lấy giao dịch của chính user (lọc theo userId)', async () => {
  let filterCap;
  Transaction.find = (f) => { filterCap = f; return chainResolving([]); };
  Transaction.countDocuments = async () => 0;

  const res = mockRes();
  await getTransactions({ user: { _id: 'USER-123' }, query: {} }, res);

  assert.equal(filterCap.userId, 'USER-123', 'Phải ép lọc theo userId để không xem được của người khác');
  assert.equal(res.statusCode, 200);
});

test('getTransactions: áp dụng filter type + status khi có', async () => {
  let filterCap;
  Transaction.find = (f) => { filterCap = f; return chainResolving([]); };
  Transaction.countDocuments = async () => 0;

  const res = mockRes();
  await getTransactions({ user: { _id: 'U1' }, query: { type: 'WALLET_DEPOSIT', status: 'SUCCESS' } }, res);

  assert.equal(filterCap.type, 'WALLET_DEPOSIT');
  assert.equal(filterCap.status, 'SUCCESS');
});
