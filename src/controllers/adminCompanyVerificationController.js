// controllers/adminCompanyVerificationController.js
import mongoose from 'mongoose';
import Company from '../models/companyModels.js';
import CompanyLocation from '../models/companyLocationModels.js';
import { CommonStatus, CompanyVerificationStatus } from '../enums/masterDataEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';

export const getPendingCompanies = async (req, res) => {
  try {
    const companies = await Company.find()
      .select('name taxCode email phone website industryIds size businessLicenseFile verificationStatus createdAt updatedAt')
      .populate('industryIds', 'name slug')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: companies.length,
      data: companies.map((company) => ({
        id: company._id,
        name: company.name,
        taxCode: company.taxCode,
        email: company.email,
        phone: company.phone,
        website: company.website,
        industries: company.industryIds,
        size: company.size,
        businessLicenseFile: company.businessLicenseFile,
        verificationStatus: company.verificationStatus,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getCompanyVerificationDetail = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid companyId'
      });
    }

    const company = await Company.findById(companyId) // Dùng findById ngắn gọn hơn
      .select('ownerUserId name taxCode website industryIds size email phone avatarUrl coverUrl description businessLicenseFile verificationStatus rejectionReason verifiedBy verifiedAt followersCount createdAt updatedAt')
      .populate('ownerUserId', 'fullName email phone')
      .populate('industryIds', 'name slug')
      .populate('verifiedBy', 'fullName email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Pending company not found'
      });
    }

    const locations = await CompanyLocation.find({
      companyId: company._id,
      status: CommonStatus.ACTIVE
    })
      .select('name addressLine province district ward latitude longitude isPrimary status createdAt updatedAt')
      .sort({ isPrimary: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        id: company._id,
        owner: company.ownerUserId,
        name: company.name,
        taxCode: company.taxCode,
        website: company.website,
        industries: company.industryIds,
        size: company.size,
        email: company.email,
        phone: company.phone,
        avatarUrl: company.avatarUrl,
        coverUrl: company.coverUrl,
        description: company.description,
        businessLicenseFile: company.businessLicenseFile,
        verificationStatus: company.verificationStatus,
        rejectionReason: company.rejectionReason,
        verifiedBy: company.verifiedBy,
        verifiedAt: company.verifiedAt,
        followersCount: company.followersCount,
        locations,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



export const approveCompanyVerification = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid companyId'
      });
    }

    const company = await Company.findOne({
      _id: companyId,
      verificationStatus: CompanyVerificationStatus.PENDING
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Pending company not found'
      });
    }

    company.verificationStatus = CompanyVerificationStatus.VERIFIED;
    company.verifiedBy = req.user._id;
    company.verifiedAt = new Date();
    company.rejectionReason = null;

    await company.save();

    // Hook: Bắn thông báo cho Owner của Company
    try {
      if (company.ownerUserId) {
        await NotificationService.create({
          receiverUserId: company.ownerUserId,
          typeCode: NotificationTypeCode.COMPANY_VERIFIED,
          title: 'Công ty của bạn đã được xác thực',
          content: `Chúc mừng! Công ty "${company.name}" đã được Admin phê duyệt. Bạn có thể bắt đầu đăng tin tuyển dụng.`,
          metadata: { companyId: company._id }
        });
      }
    } catch (notiError) {
      console.error('Lỗi bắn thông báo duyệt công ty:', notiError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Company verified successfully',
      data: {
        id: company._id,
        name: company.name,
        verificationStatus: company.verificationStatus,
        verifiedBy: company.verifiedBy,
        verifiedAt: company.verifiedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const rejectCompanyVerification = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid companyId'
      });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const company = await Company.findOne({
      _id: companyId,
      verificationStatus: CompanyVerificationStatus.PENDING
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Pending company not found'
      });
    }

    company.verificationStatus = CompanyVerificationStatus.REJECTED;
    company.rejectionReason = rejectionReason.trim();
    company.verifiedBy = req.user._id;
    company.verifiedAt = new Date();

    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Company verification rejected successfully',
      data: {
        id: company._id,
        name: company.name,
        verificationStatus: company.verificationStatus,
        rejectionReason: company.rejectionReason,
        verifiedBy: company.verifiedBy,
        verifiedAt: company.verifiedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};