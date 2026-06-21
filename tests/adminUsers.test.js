// Phần 4 — Quản lý người dùng (Admin)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import User from '../src/models/userModels.js';
import { getAllUsers } from '../src/controllers/adminUserController.js';
import { mockRes } from './helpers.js';

// chuỗi .select().sort().skip().limit() -> Promise<rows>
const selectChain = (rows = []) => ({
  select() { return { sort: () => ({ skip: () => ({ limit: async () => rows }) }) }; }
});

test('getAllUsers: KHÔNG trả passwordHash', async () => {
  let selectCap;
  User.find = () => ({
    select: (s) => { selectCap = s; return { sort: () => ({ skip: () => ({ limit: async () => [] }) }) }; }
  });
  User.countDocuments = async () => 0;

  const res = mockRes();
  await getAllUsers({ query: {} }, res);
  assert.equal(selectCap, '-passwordHash');
});

test('getAllUsers: escape ký tự regex trong search (chống injection/ReDoS)', async () => {
  let filterCap;
  User.find = (f) => { filterCap = f; return selectChain([]); };
  User.countDocuments = async () => 0;

  const res = mockRes();
  await getAllUsers({ query: { search: 'a+b(' } }, res);

  const rx = filterCap.$or[0].fullName.$regex;
  assert.equal(rx, 'a\\+b\\(', 'Ký tự + và ( phải được escape');
});
