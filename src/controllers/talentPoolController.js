import UploadedCV from '../models/uploadedCvModels.js';
import User from '../models/userModels.js';
import UnlockedCandidate from '../models/unlockedCandidateModels.js';
import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import CvBoost from '../models/cvBoostModels.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';
import { TransactionType, PaymentMethod, TransactionStatus, ServicePackageType } from '../enums/paymentEnums.js';

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

    // Lấy giá từ server, không tin client
    const pkg = await ServicePackage.findOne({
      packageType: ServicePackageType.CV_UNLOCK,
      status: 'ACTIVE'
    }).sort({ price: 1 });

    if (!pkg) {
      return res.status(400).json({ success: false, message: 'No active unlock package found' });
    }

    const amount = pkg.price;

    const wallet = await Wallet.findOne({ userId: employerId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    await Transaction.create({
      userId: employerId,
      type: TransactionType.CV_UNLOCK_SINGLE,
      amount: -amount,
      status: TransactionStatus.SUCCESS,
      paymentMethod: PaymentMethod.WALLET,
      targetType: 'CV',
      targetId: cvId,
      description: `Unlock candidate ${candidateId}`
    });

    wallet.balance -= amount;
    wallet.totalSpent += amount;
    await wallet.save();

    const unlocked = await UnlockedCandidate.create({
      employerId,
      candidateId,
      cvId: cvId || null,
      amountCharged: amount
    });

    res.status(201).json({ success: true, data: unlocked });
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