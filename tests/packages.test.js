// Phần 1 — Gói dịch vụ
import { test } from 'node:test';
import assert from 'node:assert/strict';

import ServicePackage from '../src/models/servicePackageModels.js';
import { getPackages, createPackage, updatePackageStatus } from '../src/controllers/packageController.js';
import { mockRes } from './helpers.js';

test('getPackages (public): luôn lọc status = ACTIVE', async () => {
  let filterCap;
  ServicePackage.find = (f) => { filterCap = f; return { sort: async () => [] }; };
  const res = mockRes();
  await getPackages({ query: {} }, res);
  assert.equal(filterCap.status, 'ACTIVE');
  assert.equal(res.statusCode, 200);
});

test('createPackage: thiếu trường bắt buộc -> 400', async () => {
  const res = mockRes();
  await createPackage({ body: { name: 'Chỉ có tên' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('updatePackageStatus: status không hợp lệ -> 400', async () => {
  const res = mockRes();
  await updatePackageStatus({ params: { id: '1' }, body: { status: 'BUA_BAI' } }, res);
  assert.equal(res.statusCode, 400);
});

test('updatePackageStatus: status hợp lệ (INACTIVE) -> 200', async () => {
  ServicePackage.findById = async () => ({ status: 'ACTIVE', save: async () => {} });
  const res = mockRes();
  await updatePackageStatus({ params: { id: '1' }, body: { status: 'INACTIVE' } }, res);
  assert.equal(res.statusCode, 200);
});
