import ServicePackage from '../models/servicePackageModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import { ServicePackageCode, ServicePackageTargetRole, ServicePackageType, ServicePackageUnit, UserServicePackageStatus } from '../enums/paymentEnums.js';

const validatePackageBusinessRules = ({ code, packageType, benefits }) => {
  if (code === ServicePackageCode.UNLOCK_CV_SINGLE) {
    return 'Không còn hỗ trợ gói mở khóa CV lẻ.';
  }

  if (packageType === ServicePackageType.CV_UNLOCK) {
    const cvAccessLimit = Number(benefits?.cvAccessLimit || benefits?.unlockCvCount || 0);
    if (cvAccessLimit < 2) {
      return 'Gói mở khóa CV phải có ít nhất 2 lượt. Không còn hỗ trợ gói mở khóa CV lẻ.';
    }
  }

  return null;
};

export const createPackage = async (req, res) => {
  try {
    const {
      code, name, targetRole, packageType, price, currency,
      durationDays, quantity, unit, benefits, description, sortOrder
    } = req.body;

    if (!code || !name || !targetRole || !packageType || !price || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, targetRole, packageType, price, unit'
      });
    }

    const businessError = validatePackageBusinessRules({ code, packageType, benefits });
    if (businessError) {
      return res.status(400).json({ success: false, message: businessError });
    }

    const packageData = {
      code,
      name,
      targetRole,
      packageType,
      price,
      currency: currency || 'VND',
      durationDays: durationDays || null,
      quantity: quantity || 1,
      unit,
      benefits: benefits || {
        jobPostsAllowed: 0,
        featuredDays: 0,
        cvAccessLimit: 0,
        aiPremiumAccess: false,
        priorityDisplay: false
      },
      description: description || '',
      status: 'ACTIVE',
      sortOrder: sortOrder || 0
    };

    const pkg = await ServicePackage.create(packageData);
    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, targetRole, packageType, price, currency,
      durationDays, quantity, unit, benefits, description, status, sortOrder
    } = req.body;

    const pkg = await ServicePackage.findById(id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ' });
    }

    const businessError = validatePackageBusinessRules({
      code: pkg.code,
      packageType: packageType ?? pkg.packageType,
      benefits: benefits ?? pkg.benefits
    });
    if (businessError) {
      return res.status(400).json({ success: false, message: businessError });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (targetRole !== undefined) updateData.targetRole = targetRole;
    if (packageType !== undefined) updateData.packageType = packageType;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (durationDays !== undefined) updateData.durationDays = durationDays;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (benefits !== undefined) updateData.benefits = benefits;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const updated = await ServicePackage.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updatePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ (chỉ ACTIVE hoặc INACTIVE)' });
    }

    const pkg = await ServicePackage.findById(id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ' });
    }

    pkg.status = status;
    await pkg.save();
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getPackages = async (req, res) => {
  try {
    const { targetRole, packageType } = req.query;

    const filter = { status: 'ACTIVE' };
    if (targetRole) filter.targetRole = targetRole;
    if (packageType) filter.packageType = packageType;

    if (req.user?.role === 'EMPLOYER') {
      filter.targetRole = { $in: ['EMPLOYER', 'ALL'] };
    } else if (req.user?.role === 'JOBSEEKER') {
      filter.targetRole = { $in: ['JOBSEEKER', 'ALL'] };
    }

    const packages = await ServicePackage.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();

    // Nếu có user → enrich thêm isOwned + activeSubscription
    let activeSubsByPackage = new Map();
    if (req.user?._id) {
      const activeSubs = await UserServicePackage.find({
        userId: req.user._id,
        status: UserServicePackageStatus.ACTIVE,
        packageId: { $in: packages.map(p => p._id) }
      })
        .select('packageId targetType targetId startedAt expiredAt')
        .lean();

      // Group theo packageId (1 user có thể có nhiều subscription cùng gói cho nhiều target khác nhau)
      for (const sub of activeSubs) {
        const key = sub.packageId.toString();
        if (!activeSubsByPackage.has(key)) activeSubsByPackage.set(key, []);
        activeSubsByPackage.get(key).push({
          _id: sub._id,
          targetType: sub.targetType,
          targetId: sub.targetId,
          startedAt: sub.startedAt,
          expiredAt: sub.expiredAt,
          daysRemaining: sub.expiredAt
            ? Math.max(0, Math.ceil((new Date(sub.expiredAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null
        });
      }
    }

    const enriched = packages.map(pkg => {
      const subs = activeSubsByPackage.get(pkg._id.toString()) || [];
      return {
        ...pkg,
        isOwned: subs.length > 0,
        activeSubscriptions: subs,
        activeCount: subs.length
      };
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getAllPackages = async (req, res) => {
  try {
    const { status, targetRole, packageType } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (targetRole) filter.targetRole = targetRole;
    if (packageType) filter.packageType = packageType;

    const packages = await ServicePackage.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPackageById = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await ServicePackage.findById(id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
