import UploadedCV from '../models/uploadedCvModels.js';
import User from '../models/userModels.js';
import UnlockedCandidate from '../models/unlockedCandidateModels.js';
import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import CvBoost from '../models/cvBoostModels.js';
import CvUnlockCredit from '../models/cvUnlockCreditModels.js';
import EmployerProfile from '../models/employerProfileModels.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';
import { TransactionType, PaymentMethod, TransactionStatus, ServicePackageType, CvUnlockCreditStatus } from '../enums/paymentEnums.js';

export const getTalentPool = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { search, skills, location, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matchCV = { isPublic: true };
    if (skills) matchCV.skills = { $in: skills.split(',') };
    if (location) matchCV['location.provinceCode'] = location;

    const pipeline = [
      { $match: matchCV },
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
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.fullName': { $regex: search, $options: 'i' } },
            { summary: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await UploadedCV.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Sort: CV đang boost lên đầu, sau đó theo createdAt desc
    pipeline.push({ $sort: { isBoosted: -1, createdAt: -1 } }, { $skip: skip }, { $limit: parseInt(limit) });

    const candidates = await UploadedCV.aggregate(pipeline);

    const candidateIds = candidates.map(c => c.user._id);
    const unlocked = await UnlockedCandidate.find({ employerId, candidateId: { $in: candidateIds } });
    const unlockedMap = {};
    unlocked.forEach(u => { unlockedMap[u.candidateId.toString()] = true; });

    const result = candidates.map(c => ({
      _id: c.user._id,
      fullName: c.user.fullName,
      email: unlockedMap[c.user._id.toString()] ? c.user.email : null,
      phone: unlockedMap[c.user._id.toString()] ? c.user.phone : null,
      cvId: c._id,
      title: c.title,
      summary: c.summary,
      skills: c.skills,
      location: c.location,
      experienceYears: c.experienceYears,
      isUnlocked: unlockedMap[c.user._id.toString()] || false,
      isBoosted: c.isBoosted || false
    }));

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
      const unlocked = await UnlockedCandidate.create({ employerId, candidateId, cvId: cvId || null, amountCharged: 0 });
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

    const unlocked = await UnlockedCandidate.create({ employerId, candidateId, cvId: cvId || null, amountCharged: amount });
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
export const purchaseCvUnlockPackage = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { packageId } = req.body;

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg ||
        ![ServicePackageType.CV_UNLOCK, ServicePackageType.CV_UNLOCK_BUNDLE].includes(pkg.packageType) ||
        pkg.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Gói không hợp lệ hoặc không phải gói mở khóa CV' });
    }

    const credits = pkg.benefits?.cvAccessLimit || 1;

    // Trừ ví NGUYÊN TỬ (chỉ trừ khi đủ tiền)
    const wallet = await Wallet.findOneAndUpdate(
      { userId: employerId, balance: { $gte: pkg.price } },
      { $inc: { balance: -pkg.price, totalSpent: pkg.price } },
      { new: true }
    );
    if (!wallet) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: 'Số dư ví không đủ. Vui lòng nạp thêm tiền.'
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

    const profile = await EmployerProfile.findOne({ userId: employerId }).select('companyId').lean();
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
      .populate('cvId', 'title summary skills')
      .sort({ unlockedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

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