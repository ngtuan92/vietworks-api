import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';

export const expirePremiumServices = async (req, res) => {
  try {
    const now = new Date();

    const cvResult = await CvBoost.updateMany(
      { status: UserServicePackageStatus.ACTIVE, endAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    const jobResult = await JobBoost.updateMany(
      { status: UserServicePackageStatus.ACTIVE, endAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    // Đồng bộ expire UserServicePackage (source of truth)
    const uspResult = await UserServicePackage.updateMany(
      { status: UserServicePackageStatus.ACTIVE, expiredAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    res.status(200).json({
      success: true,
      data: {
        cvBoostsExpired: cvResult.modifiedCount,
        jobBoostsExpired: jobResult.modifiedCount,
        userServicePackagesExpired: uspResult.modifiedCount,
        executedAt: now
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};