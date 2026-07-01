// Seed dữ liệu demo cho Review 1 (Gói dịch vụ + Ví + Giao dịch + Hóa đơn).
// Chạy: npm run seed   (idempotent — chạy lại không tạo trùng, đồng thời cập nhật
// các field theo PACKAGES bên dưới để đảm bảo giá/hạn luôn khớp với code mới nhất)
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

// ─── Nguồn dữ liệu gói duy nhất: mọi gói đều dùng hạn 1 tháng (30 ngày) ───
// Thứ tự sortOrder dùng để hiển thị trong Admin và trang mua của user/NTD.
const PACKAGES = [
  // ─── Ứng viên (Boost CV) — 1 tháng ───
  {
    code: 'BOOST_CV_BASIC', name: 'Boost CV 1 tháng - Cơ bản', targetRole: Role.JOBSEEKER, packageType: PType.CV_BOOST,
    price: 50000, durationDays: 30, unit: Unit.CV,
    benefits: { priorityDisplay: true },
    description: 'Đẩy CV lên top tìm kiếm, ưu tiên hiển thị trong 1 tháng.', sortOrder: 1
  },
  {
    code: 'BOOST_CV_PREMIUM', name: 'Boost CV 1 tháng - Premium', targetRole: Role.JOBSEEKER, packageType: PType.CV_BOOST,
    price: 150000, durationDays: 30, unit: Unit.CV,
    benefits: { priorityDisplay: true, aiPremiumAccess: true },
    description: 'Đẩy CV lên top + AI Premium, ưu tiên hiển thị trong 1 tháng.', sortOrder: 2
  },
  {
    code: 'BOOST_CV_PRO', name: 'Boost CV 1 năm - Pro', targetRole: Role.JOBSEEKER, packageType: PType.CV_BOOST,
    price: 499000, durationDays: 365, unit: Unit.CV,
    benefits: { priorityDisplay: true, aiPremiumAccess: true },
    description: 'Trọn gói boost CV + AI Premium suốt 1 năm — tiết kiệm nhất cho người tìm việc nghiêm túc.', sortOrder: 3
  },

  // ─── Nhà tuyển dụng (Mở khóa CV) ───
  {
    code: 'UNLOCK_CV_SINGLE', name: 'Mở khóa 1 CV', targetRole: Role.EMPLOYER, packageType: PType.CV_UNLOCK,
    price: 20000, durationDays: null, unit: Unit.CV,
    benefits: { cvAccessLimit: 1 },
    description: 'Mở khóa thông tin liên hệ của 1 hồ sơ ứng viên.', sortOrder: 1
  },
  {
    code: 'UNLOCK_CV_50_30_DAYS', name: 'Gói mở khóa 50 CV - 1 tháng', targetRole: Role.EMPLOYER, packageType: PType.CV_UNLOCK_BUNDLE,
    price: 800000, durationDays: 30, unit: Unit.CV,
    benefits: { cvAccessLimit: 50 },
    description: 'Gói mở khóa 50 CV, hạn dùng 1 tháng.', sortOrder: 2
  },
  {
    code: 'UNLOCK_CV_100_30_DAYS', name: 'Gói mở khóa 100 CV - 1 tháng', targetRole: Role.EMPLOYER, packageType: PType.CV_UNLOCK_BUNDLE,
    price: 1500000, durationDays: 30, unit: Unit.CV,
    benefits: { cvAccessLimit: 100 },
    description: 'Gói mở khóa 100 CV, hạn dùng 1 tháng.', sortOrder: 3
  },

  // ─── Nhà tuyển dụng (Tin nổi bật + Gấp) — 1 tháng ───
  {
    code: 'PREMIUM_JOB_30_DAYS', name: 'Tin nổi bật + Gấp - 1 tháng', targetRole: Role.EMPLOYER, packageType: PType.PREMIUM_JOB,
    price: 400000, durationDays: 30, unit: Unit.JOB,
    benefits: { featuredDays: 30, priorityDisplay: true },
    description: 'Đẩy tin lên top trang chủ, top tìm kiếm và gắn nhãn Gấp trong 1 tháng.', sortOrder: 4
  }
];

// Mã gói cũ (7/14 ngày) sẽ bị tắt để không còn hiển thị cho user/NTD.
const LEGACY_CODES_TO_DEACTIVATE = [
  'BOOST_CV_7_DAYS',      // gói Boost CV 7 ngày cũ
  'BOOST_CV_30_DAYS',     // gói Boost CV 30 ngày cũ (đã thay bằng BASIC/PREMIUM/PRO)
  'PREMIUM_JOB_7_DAYS',   // gói Premium Job 7 ngày cũ
  'PREMIUM_JOB_14_DAYS',  // gói Premium Job 14 ngày cũ
  'BASIC_MONTHLY',        // gói "Pro" rác 499k benefits rỗng (đã thay bằng BOOST_CV_PRO)
  'monthly'               // gói "cơ bản" rác 190k benefits rỗng
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Thiếu MONGODB_URI trong .env'); process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Đã kết nối DB');
  // 1) Gói dịch vụ — thay thế hoàn toàn dữ liệu ServicePackage bằng PACKAGES
  const deletedPackages = await ServicePackage.deleteMany({});
  const insertedPackages = await ServicePackage.insertMany(
    PACKAGES.map((pkg) => ({ ...pkg, status: 'ACTIVE' }))
  );
  console.log(`✓ Đã xóa ${deletedPackages.deletedCount} gói cũ và tạo lại ${insertedPackages.length} gói dịch vụ`);

  // 3) Một nhà tuyển dụng để gắn ví/giao dịch (ưu tiên dùng user có sẵn)
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

  // 4) Ví cho employer
  if (!(await Wallet.findOne({ userId: employer._id }))) {
    await Wallet.create({ userId: employer._id, balance: 2000000, totalDeposited: 3000000, totalSpent: 1000000 });
    console.log('✓ Tạo ví (số dư 2.000.000đ)');
  }

  // 5) Vài giao dịch demo (chỉ khi user này chưa có giao dịch)
  let depositTxId;
  if ((await Transaction.countDocuments({ userId: employer._id })) === 0) {
    const txs = await Transaction.insertMany([
      {
        userId: employer._id, type: TransactionType.WALLET_DEPOSIT, amount: 2000000, status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.SEPAY, description: 'Nạp tiền vào ví', metadata: { orderCode: 'SEVNSEED000001' }
      },
      {
        userId: employer._id, type: TransactionType.PACKAGE_PURCHASE, amount: 800000, status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET, description: 'Mua gói Mở khóa 50 CV'
      },
      {
        userId: employer._id, type: TransactionType.WALLET_DEPOSIT, amount: 1000000, status: TransactionStatus.PENDING,
        paymentMethod: PaymentMethod.SEPAY, description: 'Nạp tiền (đang chờ thanh toán)', metadata: { orderCode: 'SEVNSEED000002' }
      }
    ]);
    depositTxId = txs[0]._id;
    console.log(`✓ Tạo ${txs.length} giao dịch demo`);
  }

  // 6) Một yêu cầu hóa đơn demo cho giao dịch nạp tiền
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
