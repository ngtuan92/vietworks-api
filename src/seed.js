// Seed dữ liệu demo cho Review 1 (Gói dịch vụ + Ví + Giao dịch + Hóa đơn).
// Chạy: npm run seed   (idempotent — chạy lại không tạo trùng)
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import ServicePackage from './models/servicePackageModels.js';
import User from './models/userModels.js';
import Wallet from './models/walletModels.js';
import Transaction from './models/transactionModels.js';
import Invoice from './models/Invoice.js';
import {
  ServicePackageTargetRole as Role,
  ServicePackageType as PType,
  ServicePackageUnit as Unit,
  TransactionType, TransactionStatus, PaymentMethod
} from './enums/paymentEnums.js';
import { UserRole, AccountStatus } from './enums/userEnums.js';

dotenv.config();

const PACKAGES = [
  // ── Nhà tuyển dụng ──
  { code: 'UNLOCK_CV_SINGLE', name: 'Gói cơ bản', targetRole: Role.EMPLOYER, packageType: PType.CV_UNLOCK,
    price: 190000, durationDays: 30, unit: Unit.CV, benefits: { cvAccessLimit: 1 },
    description: 'Mở khóa 1 hồ sơ ứng viên.', sortOrder: 1 },
  { code: 'UNLOCK_CV_50_30_DAYS', name: 'Mở khóa 50 CV', targetRole: Role.EMPLOYER, packageType: PType.CV_UNLOCK_BUNDLE,
    price: 800000, durationDays: 30, unit: Unit.CV, benefits: { cvAccessLimit: 50 },
    description: 'Gói mở khóa 50 CV, hạn dùng 30 ngày.', sortOrder: 2 },
  { code: 'PREMIUM_JOB_30_DAYS', name: 'Đẩy tin nổi bật', targetRole: Role.EMPLOYER, packageType: PType.PREMIUM_JOB,
    price: 400000, durationDays: 30, unit: Unit.JOB, benefits: { featuredDays: 30, priorityDisplay: true },
    description: 'Đẩy tin lên top trang chủ, top tìm kiếm và gắn nhãn Gấp trong 30 ngày.', sortOrder: 3 },
  // ── Ứng viên ──
  { code: 'BOOST_CV_7_DAYS', name: 'Boost CV 7 ngày', targetRole: Role.JOBSEEKER, packageType: PType.CV_BOOST,
    price: 50000, durationDays: 7, unit: Unit.CV, benefits: { priorityDisplay: true },
    description: 'Ưu tiên hiển thị CV trong 7 ngày.', sortOrder: 1 },
  { code: 'BOOST_CV_30_DAYS', name: 'Boost CV 30 ngày', targetRole: Role.JOBSEEKER, packageType: PType.CV_BOOST,
    price: 150000, durationDays: 30, unit: Unit.CV, benefits: { priorityDisplay: true },
    description: 'Ưu tiên hiển thị CV trong 30 ngày.', sortOrder: 2 }
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Thiếu MONGODB_URI trong .env'); process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Đã kết nối DB');

  // 1) Gói dịch vụ (bỏ qua nếu đã tồn tại theo code)
  let added = 0;
  for (const p of PACKAGES) {
    if (!(await ServicePackage.findOne({ code: p.code }))) { await ServicePackage.create(p); added++; }
  }
  console.log(`✓ Gói dịch vụ: thêm ${added}, tổng ${await ServicePackage.countDocuments()}`);

  // 2) Một nhà tuyển dụng để gắn ví/giao dịch (ưu tiên dùng user có sẵn)
  let employer = await User.findOne({ role: UserRole.EMPLOYER });
  if (!employer) {
    employer = await User.create({
      role: UserRole.EMPLOYER, fullName: 'Demo Employer',
      email: 'demo.employer@vietworks.test', passwordHash: 'Demo@123',
      accountStatus: AccountStatus.ACTIVE
    });
    console.log('✓ Tạo demo employer: demo.employer@vietworks.test / Demo@123');
  } else {
    console.log(`✓ Dùng employer có sẵn: ${employer.email}`);
  }

  // 3) Ví cho employer
  if (!(await Wallet.findOne({ userId: employer._id }))) {
    await Wallet.create({ userId: employer._id, balance: 2000000, totalDeposited: 3000000, totalSpent: 1000000 });
    console.log('✓ Tạo ví (số dư 2.000.000đ)');
  }

  // 4) Vài giao dịch demo (chỉ khi user này chưa có giao dịch)
  let depositTxId;
  if ((await Transaction.countDocuments({ userId: employer._id })) === 0) {
    const txs = await Transaction.insertMany([
      { userId: employer._id, type: TransactionType.WALLET_DEPOSIT, amount: 2000000, status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.SEPAY, description: 'Nạp tiền vào ví', metadata: { orderCode: 'SEVNSEED000001' } },
      { userId: employer._id, type: TransactionType.PACKAGE_PURCHASE, amount: 800000, status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET, description: 'Mua gói Mở khóa 50 CV' },
      { userId: employer._id, type: TransactionType.WALLET_DEPOSIT, amount: 1000000, status: TransactionStatus.PENDING,
        paymentMethod: PaymentMethod.SEPAY, description: 'Nạp tiền (đang chờ thanh toán)', metadata: { orderCode: 'SEVNSEED000002' } }
    ]);
    depositTxId = txs[0]._id;
    console.log(`✓ Tạo ${txs.length} giao dịch demo`);
  }

  // 5) Một yêu cầu hóa đơn demo cho giao dịch nạp tiền
  if (depositTxId && !(await Invoice.findOne({ transactionId: depositTxId }))) {
    await Invoice.create({
      transactionId: depositTxId, invoiceNumber: 'INV-SEED-0001',
      buyerName: employer.fullName, buyerEmail: employer.email, amount: 2000000, status: 'PENDING'
    });
    console.log('✓ Tạo 1 yêu cầu hóa đơn demo');
  }

  console.log('\n🎉 Seed xong.');
  await mongoose.disconnect();
}

run().catch((e) => { console.error('Seed lỗi:', e); process.exit(1); });
