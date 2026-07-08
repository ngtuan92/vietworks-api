import UploadedCV from '../models/uploadedCvModels.js';
import Cv from '../models/cvModels.js';
import User from '../models/userModels.js';
import UnlockedCandidate from '../models/unlockedCandidateModels.js';
import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import CvBoost from '../models/cvBoostModels.js';
import CvUnlockCredit from '../models/cvUnlockCreditModels.js';
import EmployerProfile from '../models/employerProfileModels.js';
import Skill from '../models/skillModels.js';

import Application from '../models/applicationModels.js';
import Job from '../models/jobModels.js';
import NotificationService from '../services/notificationService.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';
import { TransactionType, PaymentMethod, TransactionStatus, ServicePackageType, CvUnlockCreditStatus } from '../enums/paymentEnums.js';
import { ApplicationStatus } from '../enums/jobEnums.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';
import { computeCreditUpgradeQuote, getPackageCredits } from '../utils/proration.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';
import mongoose from 'mongoose';

export const getTalentPool = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { search, skills, location, experience, industry, salary, level, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matchCV = { isPublic: true, status: 'ACTIVE' };
    if (skills) matchCV.skills = { $in: skills.split(',') };
    // Đã bỏ location ở đây để có thể search được location ở cả CV và Profile (chỗ Nhu cầu việc làm)

    const pipeline = [
      { $match: matchCV },
      { $unionWith: { coll: 'cvs', pipeline: [{ $match: matchCV }] } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.role': UserRole.JOBSEEKER,
          'user.accountStatus': AccountStatus.ACTIVE
        }
      },
      {
        $lookup: {
          from: 'jobseeker_profiles',
          localField: 'userId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      {
        $unwind: { path: '$profile', preserveNullAndEmptyArrays: true }
      }
    ];

    const matchProfile = {};
    if (industry) {
      matchProfile['profile.desiredJob.careerGroupId'] = new mongoose.Types.ObjectId(industry);
    }
    if (experience) {
      matchProfile['profile.desiredJob.experience'] = experience;
    }
    if (level) {
      matchProfile['profile.desiredJob.jobLevelId'] = new mongoose.Types.ObjectId(level);
    }
    if (Object.keys(matchProfile).length > 0) {
      pipeline.push({ $match: matchProfile });
    }

    if (salary) {
      const [minStr, maxStr] = salary.split('-');
      const min = Number(minStr);
      const max = Number(maxStr);
      if (!isNaN(min) && !isNaN(max)) {
        pipeline.push({
          $match: {
            $and: [
              {
                $or: [
                  { 'profile.desiredJob.salaryExpectationMillion.min': { $lte: max } },
                  { 'profile.desiredJob.salaryExpectationMillion.min': null },
                  { 'profile.desiredJob.salaryExpectationMillion.min': { $exists: false } }
                ]
              },
              {
                $or: [
                  { 'profile.desiredJob.salaryExpectationMillion.max': { $gte: min } },
                  { 'profile.desiredJob.salaryExpectationMillion.max': null },
                  { 'profile.desiredJob.salaryExpectationMillion.max': { $exists: false } }
                ]
              }
            ]
          }
        });
      }
    }

    // Match Location: Khớp location của CV (nếu có) HOẶC location trong Nhu cầu việc làm (profile)
    if (location) {
      pipeline.push({
        $match: {
          $or: [
            { 'location.provinceCode': location },
            { 'profile.desiredJob.workLocations.provinceCode': location }
          ]
        }
      });
    }

    pipeline.push(
      // Lookup CvBoost ACTIVE để ưu tiên CV đang boost
      {
        $lookup: {
          from: 'cv_boosts',
          let: { cvId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$cvId', '$$cvId'] },
                status: 'ACTIVE'
              }
            },
            { $limit: 1 }
          ],
          as: 'activeBoost'
        }
      },
      { $addFields: { isBoosted: { $gt: [{ $size: '$activeBoost' }, 0] } } }
    );

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.fullName': { $regex: search, $options: 'i' } },
            { summary: { $regex: search, $options: 'i' } },
            { extractedText: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await UploadedCV.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Sort: CV đang boost lên đầu, sau đó theo createdAt desc
    pipeline.push({ $sort: { isBoosted: -1, boostPackagePrice: -1, boostedAt: -1, createdAt: -1 } }, { $skip: skip }, { $limit: parseInt(limit) });

    const candidates = await UploadedCV.aggregate(pipeline);

    const candidateIds = candidates.map(c => c.user._id);
    const unlocked = await UnlockedCandidate.find({ employerId, candidateId: { $in: candidateIds } });
    const unlockedMap = {};
    unlocked.forEach(u => { unlockedMap[u.candidateId.toString()] = true; });

    // Fetch employer's companyId to check if they have invited these candidates
    const employerProfile = await EmployerProfile.findOne({ userId: employerId });
    const companyId = employerProfile?.companyId;
    let invitedMap = {};
    let applicationsMap = {};
    if (companyId) {
      const allApps = await Application.find({
        companyId,
        jobseekerUserId: { $in: candidateIds }
      }).populate('jobId', 'title').sort({ createdAt: -1 }).lean();
      
      allApps.forEach(app => {
        const uId = app.jobseekerUserId.toString();
        // Chỉ lấy những Application đã qua bước mời phỏng vấn
        if ([ApplicationStatus.INTERVIEW_INVITED, ApplicationStatus.APPROVED, ApplicationStatus.REJECTED].includes(app.status)) {
          if (!applicationsMap[uId]) applicationsMap[uId] = [];
          applicationsMap[uId].push({ 
            _id: app._id, 
            status: app.status, 
            jobId: app.jobId?._id || app.jobId, 
            jobTitle: app.jobId?.title || 'Công việc đã xóa' 
          });
          if (app.status === ApplicationStatus.INTERVIEW_INVITED) {
            invitedMap[uId] = true;
          }
        }
      });
    }

    // Fetch fallback data from JobseekerProfile
    const skillIds = new Set();

    candidates.forEach(c => {
      if (c.profile?.skills) c.profile.skills.forEach(s => skillIds.add(s.toString()));
    });

    const skillsData = await Skill.find({ _id: { $in: Array.from(skillIds) } });

    const skillMap = {};
    skillsData.forEach(s => skillMap[s._id.toString()] = s.name);

    const result = candidates.map(c => {
      const loc = c.location?.provinceCode || c.profile?.desiredJob?.workLocations?.[0]?.provinceName || '';
      const exp = c.experienceYears ? `${c.experienceYears} năm` : (c.profile?.desiredJob?.experience || '');
      const profileSkills = (c.profile?.skills || []).map(sid => skillMap[sid.toString()]).filter(Boolean);
      const skls = (c.skills && c.skills.length > 0) ? c.skills : profileSkills;

      return {
        _id: c.user._id,
        fullName: c.user.fullName,
        email: unlockedMap[c.user._id.toString()] ? c.user.email : null,
        phone: unlockedMap[c.user._id.toString()] ? c.user.phone : null,
        cvId: c._id,
        title: c.title,
        summary: c.summary,
        skills: skls,
        location: loc ? { provinceCode: loc } : null,
        experienceYears: exp,
        isUnlocked: unlockedMap[c.user._id.toString()] || false,
        isBoosted: c.isBoosted || false,
        isInvited: invitedMap[c.user._id.toString()] || false,
        applications: applicationsMap[c.user._id.toString()] || [],
        fileUrl: unlockedMap[c.user._id.toString()] ? c.fileUrl : null,
        fileName: unlockedMap[c.user._id.toString()] ? c.fileName : null
      };
    });

    res.status(200).json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTalentPoolCvPreview = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { cvId } = req.params;

    // First check if the CV exists in Cv (Template) collection
    const Cv = (await import('../models/cvModels.js')).default;
    const cv = await Cv.findById(cvId).populate('templateId style.fontId style.themeColorId');
    
    if (!cv) {
      return res.status(404).json({ success: false, message: 'CV không tồn tại' });
    }

    // Check if employer has unlocked the candidate
    const isUnlocked = await UnlockedCandidate.exists({ employerId, candidateId: cv.userId });
    
    if (!cv.isPublic && !isUnlocked) {
      return res.status(403).json({ success: false, message: 'CV này không công khai' });
    }

    // If not unlocked, we would mask contact info, but since the button is only shown WHEN unlocked, we just return the full CV.
    if (!isUnlocked) {
      return res.status(403).json({ success: false, message: 'Bạn cần mở khóa ứng viên để xem chi tiết CV' });
    }

    res.status(200).json({ success: true, data: { type: 'ONLINE', cvData: cv } });
  } catch (error) {
    console.error('Error in getTalentPoolCvPreview:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống' });
  }
};

export const unlockCandidate = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { candidateId } = req.params;
    const { cvId } = req.body;

    const existing = await UnlockedCandidate.findOne({ employerId, candidateId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Candidate already unlocked',
        data: existing
      });
    }

    // ─── ƯU TIÊN 1: dùng CREDIT từ gói đã mua (CvUnlockCredit) ───
    // Atomic trừ 1 credit của gói còn hạn & còn lượt; chọn gói sắp hết hạn trước.
    const credit = await CvUnlockCredit.findOneAndUpdate(
      {
        employerUserId: employerId,
        status: CvUnlockCreditStatus.ACTIVE,
        remainingCredits: { $gte: 1 },
        expiredAt: { $gt: new Date() }
      },
      { $inc: { remainingCredits: -1, usedCredits: 1 } },
      { new: true, sort: { expiredAt: 1 } }
    );

    if (credit) {
      // Hết lượt → đánh dấu USED_UP
      if (credit.remainingCredits <= 0) {
        await CvUnlockCredit.updateOne({ _id: credit._id }, { $set: { status: CvUnlockCreditStatus.USED_UP } });
      }
      await Transaction.create({
        userId: employerId,
        type: TransactionType.CV_UNLOCK_BY_PACKAGE,
        amount: 0,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        targetType: 'CV',
        targetId: cvId,
        description: `Mở khóa CV bằng gói (còn ${credit.remainingCredits} lượt)`
      });
      const creditPkg = await ServicePackage.findById(credit.packageId).select('name');
      const packageName = creditPkg ? creditPkg.name : credit.packageCode;

      const unlocked = await UnlockedCandidate.create({ 
        employerId, 
        candidateId, 
        cvId: cvId || null, 
        amountCharged: 0,
        packageId: credit.packageId,
        packageName 
      });
      return res.status(201).json({
        success: true,
        data: unlocked,
        message: `Đã mở khóa bằng gói — còn ${credit.remainingCredits} lượt`
      });
    }

    // ─── ƯU TIÊN 2: không có credit → trừ ví trực tiếp (gói lẻ rẻ nhất) ───
    const pkg = await ServicePackage.findOne({
      packageType: ServicePackageType.CV_UNLOCK,
      status: 'ACTIVE'
    }).sort({ price: 1 });
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'No active unlock package found' });
    }
    const amount = pkg.price;

    // Atomic trừ ví (chỉ trừ khi đủ) — chống race
    const wallet = await Wallet.findOneAndUpdate(
      { userId: employerId, balance: { $gte: amount } },
      { $inc: { balance: -amount, totalSpent: amount } },
      { new: true }
    );
    if (!wallet) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: 'Số dư ví không đủ. Hãy mua gói mở khóa hoặc nạp thêm tiền.'
      });
    }

    await Transaction.create({
      userId: employerId,
      type: TransactionType.CV_UNLOCK_SINGLE,
      amount,
      status: TransactionStatus.SUCCESS,
      paymentMethod: PaymentMethod.WALLET,
      targetType: 'CV',
      targetId: cvId,
      packageId: pkg._id,
      packageSnapshot: {
        id: pkg._id,
        code: pkg.code,
        name: pkg.name,
        type: pkg.packageType,
        price: pkg.price,
        durationDays: pkg.durationDays
      },
      description: `Mở khóa CV (lẻ) - ${candidateId}`
    });

    const unlocked = await UnlockedCandidate.create({ 
      employerId, 
      candidateId, 
      cvId: cvId || null, 
      amountCharged: amount,
      packageId: pkg._id,
      packageName: pkg.name
    });
    res.status(201).json({ success: true, data: unlocked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Employer MUA gói Mở khóa CV (CV_UNLOCK / CV_UNLOCK_BUNDLE) bằng VÍ.
 * Trừ ví → tạo Transaction SUCCESS → cấp túi credit (CvUnlockCredit) = cvAccessLimit lượt.
 * Các lượt này sẽ được unlockCandidate tiêu trước khi trừ ví.
 */
/**
 * Resolve "giá gốc" (cost basis) của 1 túi credit để tính bù khi nâng cấp.
 * Ưu tiên field pricePaid (mới); fallback giá gói hiện tại → số tiền giao dịch gốc → 0.
 * Bảo toàn kinh tế: hoàn tiền không bao giờ vượt quá tiền đã thực nạp vào túi.
 */
const resolveBagPricePaid = async (bag) => {
  if (bag.pricePaid && bag.pricePaid > 0) return bag.pricePaid;
  const pkg = bag.packageId ? await ServicePackage.findById(bag.packageId).select('price').lean() : null;
  if (pkg?.price > 0) return pkg.price;
  const txn = bag.transactionId ? await Transaction.findById(bag.transactionId).select('amount').lean() : null;
  return txn?.amount || 0;
};

/**
 * Liệt kê các túi credit ĐANG hiệu lực (ACTIVE, chưa hết hạn, còn lượt) của employer.
 * FE dùng để hiện lựa chọn "nâng cấp túi hiện tại" kèm cost basis.
 */
export const getCvUnlockCredits = async (req, res) => {
  try {
    const employerId = req.user._id;
    const bags = await CvUnlockCredit.find({
      employerUserId: employerId,
      status: CvUnlockCreditStatus.ACTIVE,
      remainingCredits: { $gt: 0 },
      expiredAt: { $gt: new Date() }
    }).populate('packageId', 'name price').sort({ expiredAt: 1 }).lean();

    const data = await Promise.all(bags.map(async (b) => ({
      _id: b._id,
      packageCode: b.packageCode,
      packageName: b.packageId?.name || b.packageCode,
      totalCredits: b.totalCredits,
      remainingCredits: b.remainingCredits,
      pricePaid: await resolveBagPricePaid(b),
      expiredAt: b.expiredAt
    })));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Employer MUA / NÂNG CẤP gói Mở khóa CV (CV_UNLOCK / CV_UNLOCK_BUNDLE) bằng VÍ.
 *
 * action='new' (mặc định): tạo túi credit MỚI riêng (cộng dồn lượt) — spec §6.4.
 * action='upgrade': nâng cấp theo LƯỢT DÙNG (usage-based), chống lỗ tuyệt đối:
 *   giá trị còn lại = giá gốc túi cũ × (lượt còn / tổng lượt)   ← chỉ hoàn lượt CHƯA dùng
 *   phải bù        = giá gói mới − giá trị còn lại
 * Túi cũ → CANCELLED; túi mới mang notional = giá gói mới (chain-safe).
 */
export const purchaseCvUnlockPackage = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { packageId, action = 'new', fromCreditId, paymentMethod: requestedMethod = PaymentMethod.WALLET } = req.body;

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg ||
      ![ServicePackageType.CV_UNLOCK, ServicePackageType.CV_UNLOCK_BUNDLE].includes(pkg.packageType) ||
      pkg.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Gói không hợp lệ hoặc không phải gói mở khóa CV' });
    }

    const credits = getPackageCredits(pkg);
    const profile = await EmployerProfile.findOne({ userId: employerId }).select('companyId').lean();

    // ══════════ NHÁNH NÂNG CẤP theo LƯỢT (usage-based, chỉ hỗ trợ VÍ) ══════════
    if (action === 'upgrade') {
      const activeBags = await CvUnlockCredit.find({
        employerUserId: employerId,
        status: CvUnlockCreditStatus.ACTIVE,
        remainingCredits: { $gt: 0 },
        expiredAt: { $gt: new Date() }
      }).sort({ expiredAt: 1 });

      let oldBag = null;
      if (fromCreditId) {
        oldBag = activeBags.find(b => String(b._id) === String(fromCreditId)) || null;
        if (!oldBag) {
          return res.status(400).json({ success: false, code: 'CREDIT_NOT_FOUND', message: 'Không tìm thấy túi lượt hợp lệ để nâng cấp.' });
        }
      } else if (activeBags.length === 1) {
        oldBag = activeBags[0];
      } else if (activeBags.length === 0) {
        return res.status(400).json({ success: false, code: 'NO_ACTIVE_CREDIT', message: 'Bạn chưa có túi lượt nào đang hoạt động để nâng cấp. Vui lòng mua mới.' });
      } else {
        return res.status(400).json({
          success: false, code: 'MULTIPLE_CREDITS',
          message: 'Bạn có nhiều túi lượt đang hoạt động. Vui lòng chọn túi muốn nâng cấp.',
          data: { bags: activeBags.map(b => ({ _id: b._id, packageCode: b.packageCode, remainingCredits: b.remainingCredits, totalCredits: b.totalCredits, expiredAt: b.expiredAt })) }
        });
      }

      const pricePaid = await resolveBagPricePaid(oldBag);
      const quote = computeCreditUpgradeQuote(oldBag, pricePaid, pkg);

      // Chặn downgrade: gói mới không được rẻ hơn giá trị còn lại của túi cũ
      if (quote.downgrade) {
        return res.status(400).json({
          success: false, code: 'DOWNGRADE_NOT_ALLOWED',
          message: `Không thể nâng cấp lên gói rẻ hơn giá trị còn lại (${quote.remainingValue.toLocaleString('vi-VN')}đ). Hãy chọn gói lớn hơn hoặc dùng hết lượt hiện tại.`,
          data: { remainingValue: quote.remainingValue, newPackage: { name: pkg.name, price: pkg.price } }
        });
      }

      // Trừ ví NGUYÊN TỬ theo tiền bù — nếu thiếu thì trả lỗi TRƯỚC khi huỷ túi cũ
      const wallet = await Wallet.findOneAndUpdate(
        { userId: employerId, balance: { $gte: quote.upgradePrice } },
        { $inc: { balance: -quote.upgradePrice, totalSpent: quote.upgradePrice } },
        { new: true }
      );
      if (!wallet) {
        return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: 'Số dư ví không đủ để nâng cấp. Vui lòng nạp thêm tiền.' });
      }

      // Ví đã trừ xong → giờ mới huỷ túi cũ (an toàn khi ví thiếu)
      oldBag.status = CvUnlockCreditStatus.CANCELLED;
      oldBag.remainingCredits = 0;
      await oldBag.save();

      const balanceAfter = wallet.balance;
      const transaction = await Transaction.create({
        userId: employerId,
        walletId: wallet._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: quote.upgradePrice,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        packageId,
        balanceBefore: balanceAfter + quote.upgradePrice,
        balanceAfter,
        description: `Nâng cấp lên ${pkg.name} (${credits} lượt) — bù ${quote.upgradePrice.toLocaleString('vi-VN')}đ từ ${oldBag.packageCode}`,
        metadata: {
          paidAt: new Date(),
          upgradeFrom: {
            creditId: oldBag._id,
            packageCode: oldBag.packageCode,
            remainingCredits: quote.remainingCredits,
            totalCredits: quote.totalCredits,
            remainingValue: quote.remainingValue,
            fullPrice: pkg.price
          }
        }
      });

      const startedAt = new Date();
      const expiredAt = new Date(startedAt.getTime() + (pkg.durationDays || 365) * 24 * 60 * 60 * 1000);
      const credit = await CvUnlockCredit.create({
        employerUserId: employerId,
        companyId: profile?.companyId || null,
        packageId: pkg._id,
        packageCode: pkg.code,
        totalCredits: credits,
        usedCredits: 0,
        remainingCredits: credits,
        pricePaid: pkg.price, // túi mới mang notional = giá gói mới (chain-safe)
        startedAt,
        expiredAt,
        status: CvUnlockCreditStatus.ACTIVE,
        transactionId: transaction._id
      });

      return res.status(200).json({
        success: true,
        data: {
          method: PaymentMethod.WALLET,
          upgraded: true,
          transactionId: transaction._id,
          packageName: pkg.name,
          amount: quote.upgradePrice,
          fullPrice: pkg.price,
          discount: quote.remainingValue,
          newBalance: balanceAfter,
          creditsGranted: credits,
          remainingCredits: credit.remainingCredits,
          expiredAt
        }
      });
    }

    // ══════════ MUA MỚI ══════════
    const paymentMethod = requestedMethod === PaymentMethod.SEPAY ? PaymentMethod.SEPAY : PaymentMethod.WALLET;

    // ─── Mua mới qua VÍ (tạo túi ngay) ───
    if (paymentMethod === PaymentMethod.WALLET) {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: employerId, balance: { $gte: pkg.price } },
        { $inc: { balance: -pkg.price, totalSpent: pkg.price } },
        { new: true }
      );
      if (!wallet) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư ví không đủ. Vui lòng nạp thêm tiền hoặc chọn thanh toán qua mã QR.'
        });
      }

      const balanceAfter = wallet.balance;
      const transaction = await Transaction.create({
        userId: employerId,
        walletId: wallet._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: pkg.price,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        packageId,
        balanceBefore: balanceAfter + pkg.price,
        balanceAfter,
        description: `Mua ${pkg.name} (${credits} lượt mở khóa CV)`,
        metadata: { paidAt: new Date() }
      });

      const startedAt = new Date();
      const expiredAt = new Date(startedAt.getTime() + (pkg.durationDays || 365) * 24 * 60 * 60 * 1000);
      const credit = await CvUnlockCredit.create({
        employerUserId: employerId,
        companyId: profile?.companyId || null,
        packageId: pkg._id,
        packageCode: pkg.code,
        totalCredits: credits,
        usedCredits: 0,
        remainingCredits: credits,
        pricePaid: pkg.price,
        startedAt,
        expiredAt,
        status: CvUnlockCreditStatus.ACTIVE,
        transactionId: transaction._id
      });

      return res.status(200).json({
        success: true,
        data: {
          method: PaymentMethod.WALLET,
          transactionId: transaction._id,
          packageName: pkg.name,
          amount: pkg.price,
          newBalance: balanceAfter,
          creditsGranted: credits,
          remainingCredits: credit.remainingCredits,
          expiredAt
        }
      });
    }

    // ─── Mua mới qua SEPAY (giao dịch PENDING + QR; túi được cấp khi webhook xác nhận) ───
    const transaction = await Transaction.create({
      userId: employerId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: pkg.price,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      packageId,
      packageSnapshot: {
        id: pkg._id,
        code: pkg.code,
        name: pkg.name,
        type: pkg.packageType,
        price: pkg.price,
        durationDays: pkg.durationDays
      },
      description: `Mua ${pkg.name} (${credits} lượt mở khóa CV)`,
      metadata: {}
    });

    const orderCode = generateOrderCode(transaction._id.toString());
    transaction.metadata = { ...transaction.metadata, orderCode };
    await transaction.save();

    const bankAccount = process.env.SEPAY_BANK_ACCOUNT || '1017588888';
    const bankName = process.env.SEPAY_BANK_NAME || 'Vietcombank';
    const bankOwner = process.env.SEPAY_BANK_OWNER || 'NGUYEN TIEN DUNG';
    const qrUrl = createQRPaymentUrl({ account: bankAccount, bank: bankName, amount: pkg.price, orderCode });
    const transferContent = buildTransferContent(orderCode);

    return res.status(200).json({
      success: true,
      data: {
        method: PaymentMethod.SEPAY,
        transactionId: transaction._id,
        orderCode,
        amount: pkg.price,
        qrUrl,
        transferContent,
        bankAccount,
        bankName,
        bankOwner
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUnlockedCandidates = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const unlocked = await UnlockedCandidate.find({ employerId })
      .populate('candidateId', 'fullName email phone')
      .populate('cvId', 'title summary skills fileUrl fileName')
      .sort({ unlockedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const candidateIds = unlocked.map(u => u.candidateId?._id).filter(Boolean);
    const uploadedCvs = await UploadedCV.find({ userId: { $in: candidateIds }, isPublic: true, status: 'ACTIVE' })
      .select('title summary skills fileUrl fileName userId')
      .lean();
    const templateCvs = await Cv.find({ userId: { $in: candidateIds }, isPublic: true, status: 'ACTIVE' })
      .select('title summary skills userId')
      .lean();
    const allPublicCvs = [...uploadedCvs, ...templateCvs];

    const employerProfile = await EmployerProfile.findOne({ userId: employerId });
    const companyId = employerProfile?.companyId;
    let applicationsMap = {};
    if (companyId && candidateIds.length > 0) {
      const allApps = await Application.find({
        companyId,
        jobseekerUserId: { $in: candidateIds }
      }).populate('jobId', 'title').sort({ createdAt: -1 }).lean();
      
      allApps.forEach(app => {
        const uId = app.jobseekerUserId.toString();
        // Chỉ lấy những Application đã qua bước mời phỏng vấn
        if ([ApplicationStatus.INTERVIEW_INVITED, ApplicationStatus.APPROVED, ApplicationStatus.REJECTED].includes(app.status)) {
          if (!applicationsMap[uId]) applicationsMap[uId] = [];
          applicationsMap[uId].push({ 
            _id: app._id, 
            status: app.status, 
            jobId: app.jobId?._id || app.jobId, 
            jobTitle: app.jobId?.title || 'Công việc đã xóa' 
          });
        }
      });
    }

    unlocked.forEach(u => {
      const cIdStr = u.candidateId?._id?.toString();
      u.allCvs = allPublicCvs.filter(cv => cv.userId.toString() === cIdStr);
      u.applications = applicationsMap[cIdStr] || [];
    });

    const total = await UnlockedCandidate.countDocuments({ employerId });

    res.status(200).json({
      success: true,
      data: unlocked,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const inviteToInterview = async (req, res) => {
  try {
    const employerUserId = req.user._id;
    const { candidateId } = req.params;
    const { jobId, interviewTime, interviewType, location, contactPerson, contactPhone, note, cvId } = req.body;

    if (!jobId || !interviewTime || !interviewType || !location) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (Công việc, Thời gian, Hình thức, Địa điểm)' });
    }

    // Kiểm tra xem NTD đã mở khóa ứng viên này chưa
    const unlocked = await UnlockedCandidate.findOne({ employerId: employerUserId, candidateId });
    if (!unlocked) {
      return res.status(403).json({ success: false, message: 'Bạn chưa mở khóa ứng viên này' });
    }

    // Lấy thông tin công ty của NTD
    const employerProfile = await EmployerProfile.findOne({ userId: employerUserId }).populate('companyId');
    if (!employerProfile || !employerProfile.companyId) {
      return res.status(403).json({ success: false, message: 'Bạn chưa thuộc công ty nào' });
    }
    const companyId = employerProfile.companyId._id;

    // Kiểm tra Job có hợp lệ không
    const job = await Job.findOne({ _id: jobId, companyId, status: 'PUBLISHED' });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc đang tuyển này' });
    }

    const interviewInvitation = {
      interviewTime,
      interviewType,
      location,
      contactPerson,
      contactPhone,
      note,
      createdAt: new Date()
    };

    let application = await Application.findOne({ jobId, jobseekerUserId: candidateId });
    if (application) {
      application.status = ApplicationStatus.INTERVIEW_INVITED;
      application.interviewInvitation = interviewInvitation;
      application.uploadedCvId = application.uploadedCvId || cvId || null;
      application.viewedAt = application.viewedAt || new Date();
      if (!application.expectedWorkLocation && job.workLocations && job.workLocations.length > 0) {
        application.expectedWorkLocation = {
          provinceName: job.workLocations[0].provinceName,
          provinceCode: job.workLocations[0].provinceCode,
          districtName: job.workLocations[0].districtName,
          districtCode: job.workLocations[0].districtCode,
          address: job.workLocations[0].address
        };
      }
      application.statusHistory.push({
        status: ApplicationStatus.INTERVIEW_INVITED,
        changedBy: employerUserId,
        changedAt: new Date(),
        note: 'Được mời phỏng vấn trực tiếp từ Talent Pool'
      });
      await application.save();
    } else {
      application = await Application.create({
        jobId,
        companyId,
        jobseekerUserId: candidateId,
        uploadedCvId: cvId || null,
        expectedWorkLocation: job.workLocations && job.workLocations.length > 0 ? {
          provinceName: job.workLocations[0].provinceName,
          provinceCode: job.workLocations[0].provinceCode,
          districtName: job.workLocations[0].districtName,
          districtCode: job.workLocations[0].districtCode,
          address: job.workLocations[0].address
        } : null,
        status: ApplicationStatus.INTERVIEW_INVITED,
        personalDataAgreementAccepted: true,
        interviewInvitation,
        viewedAt: new Date(),
        statusHistory: [{
          status: ApplicationStatus.INTERVIEW_INVITED,
          changedBy: employerUserId,
          changedAt: new Date(),
          note: 'Được mời phỏng vấn trực tiếp từ Talent Pool'
        }]
      });
    }

    // Gửi thông báo cho ứng viên
    const jobTitle = job.title;
    const companyName = employerProfile.companyId.name;
    const companyLogo = employerProfile.companyId.avatarUrl;

    await NotificationService.create({
      receiverUserId: candidateId,
      typeCode: NotificationTypeCode.INTERVIEW_INVITATION,
      title: 'Bạn nhận được lời mời phỏng vấn!',
      content: `Công ty ${companyName} đã gửi cho bạn lời mời phỏng vấn cho vị trí ${jobTitle}.`,
      metadata: {
        applicationId: application._id.toString(),
        jobId: job._id.toString(),
        jobTitle: jobTitle,
        companyId: companyId.toString(),
        companyName: companyName,
        companyLogo: companyLogo,
        status: 'INTERVIEW_INVITED',
        interviewTime,
        interviewType,
        location,
        contactPerson,
        contactPhone,
        note,
        employerUserId: employerUserId.toString()
      }
    });

    res.json({ success: true, message: 'Đã gửi lời mời phỏng vấn thành công', data: application });
  } catch (error) {
    console.error('inviteToInterview error:', error);
    res.status(500).json({ success: false, message: 'Không thể gửi lời mời phỏng vấn' });
  }
};
