import EmployerProfile from '../models/employerProfileModels.js';
import Company from '../models/companyModels.js';
import CompanyLocation from '../models/companyLocationModels.js';
import CompanyIndustry from '../models/companyIndustryModels.js';
import { CommonStatus,  CompanyVerificationStatus
 } from '../enums/masterDataEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode, NotificationChannel } from '../enums/notificationEnums.js';
import User from '../models/userModels.js';
import { UserRole } from '../enums/userEnums.js';


const buildIndustryNameSnapshots = async (industryIds = []) => {
  if (!Array.isArray(industryIds) || industryIds.length === 0) return [];

  const industries = await CompanyIndustry.find({ _id: { $in: industryIds } })
    .select('name')
    .lean();

  return industries.map((industry) => industry.name).filter(Boolean);
};

export const getMyCompanyProfile = async (req, res) => {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile || !employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer has no company'
      });
    }

    const company = await Company.findOne({
      _id: employerProfile.companyId,
      ownerUserId: req.user._id
    })
      .select('name taxCode website industryIds size email phone description avatarUrl coverUrl verificationStatus rejectionReason businessLicenseFile')
      .populate('industryIds', 'name slug');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy công ty'
      });
    }

    const locations = await CompanyLocation.find({
      companyId: company._id,
      status: CommonStatus.ACTIVE
    }).select('name addressLine province district ward latitude longitude isPrimary');

    return res.status(200).json({
      success: true,
      data: {
        id: company._id,
        name: company.name,
        taxCode: company.taxCode,
        website: company.website,
        industries: company.industryIds,
        size: company.size,
        email: company.email,
        phone: company.phone,
        description: company.description,
        avatarUrl: company.avatarUrl,
        coverUrl: company.coverUrl,
        verificationStatus: company.verificationStatus,
        rejectionReason: company.rejectionReason,
        businessLicenseFile: company.businessLicenseFile,
        locations
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};





export const updateMyCompanyProfile = async (req, res) => {
  try {
    const {
      name,
      taxCode,
      website,
      industryIds,
      size,
      email,
      phone,
      avatarUrl,
      coverUrl,
      description,
      businessLicenseFile
    } = req.body;

    const missingFields = [];
    if (!name) missingFields.push('Tên công ty');
    if (!taxCode) missingFields.push('Mã số thuế');
    if (!industryIds || !industryIds.length) missingFields.push('Ngành nghề');
    if (!size) missingFields.push(`Quy mô (${size})`);
    if (!email) missingFields.push('Email');
    if (!phone) missingFields.push('Số điện thoại');
    if (!description) missingFields.push('Mô tả');

    if (missingFields.length > 0) {
      console.log('Validation Failed. Missing:', missingFields, 'Body:', req.body);
      return res.status(400).json({
        success: false,
        message: `Vui lòng nhập đầy đủ: ${missingFields.join(', ')} (Hiện đang thiếu)`
      });
    }

    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile?.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer has no company'
      });
    }

    const industryNameSnapshots = await buildIndustryNameSnapshots(industryIds);

    const updateData = {
      name,
      taxCode,
      website: website || null,
      industryIds,
      industryNameSnapshots,
      size,
      email,
      phone,
      description
    };

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || null;
    }

    if (coverUrl !== undefined) {
      updateData.coverUrl = coverUrl || null;
    }

   const currentCompany = await Company.findOne({
  _id: employerProfile.companyId,
  ownerUserId: req.user._id
}).select('name taxCode businessLicenseFile verificationStatus');

if (!currentCompany) {
  return res.status(404).json({
    success: false,
    message: 'Company not found or not owned by this employer'
  });
}

let isCrucialInfoChanged = false;

if (currentCompany.name !== name || currentCompany.taxCode !== taxCode) {
  isCrucialInfoChanged = true;
}

if (businessLicenseFile !== undefined) {
  const oldFileUrl = currentCompany.businessLicenseFile?.fileUrl || null;
  const newFileUrl = businessLicenseFile?.fileUrl || null;
  if (oldFileUrl !== newFileUrl) {
    isCrucialInfoChanged = true;
  }
  updateData.businessLicenseFile = businessLicenseFile || null;
}

if (isCrucialInfoChanged) {
  updateData.rejectionReason = null;
  updateData.verifiedBy = null;
  updateData.verifiedAt = null;

  if (currentCompany.verificationStatus === CompanyVerificationStatus.VERIFIED) {
    updateData.verificationStatus = CompanyVerificationStatus.PENDING;
  }

  if (currentCompany.verificationStatus === CompanyVerificationStatus.REJECTED) {
    updateData.verificationStatus = CompanyVerificationStatus.UNVERIFIED;
  }
}

    const company = await Company.findOneAndUpdate(
      {
        _id: employerProfile.companyId,
        ownerUserId: req.user._id
      },
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('industryIds', 'name slug');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy công ty hoặc công ty không thuộc nhà tuyển dụng này'
      });
    }

    if (isCrucialInfoChanged && company.verificationStatus === CompanyVerificationStatus.PENDING) {
      // Notify employer
      NotificationService.create({
        receiverUserId: req.user._id,
        typeCode: NotificationTypeCode.SYSTEM_UPDATE,
        title: 'Hồ sơ công ty cần duyệt lại',
        content: `Hồ sơ công ty "${company.name}" vừa được cập nhật thông tin quan trọng (Tên công ty, Mã số thuế, hoặc Giấy phép kinh doanh) và đã chuyển sang trạng thái "Chờ duyệt". Vui lòng chờ Admin kiểm tra và xác nhận.`,
        channels: [NotificationChannel.IN_APP]
      }).catch(err => console.error('Notify employer error:', err));

      // Notify admins
      User.find({ role: UserRole.ADMIN }).select('_id').then(admins => {
        admins.forEach(admin => {
          NotificationService.create({
            receiverUserId: admin._id,
            typeCode: NotificationTypeCode.SYSTEM_UPDATE,
            title: 'Công ty yêu cầu duyệt lại',
            content: `Công ty "${company.name}" vừa cập nhật thông tin quan trọng và đang chờ duyệt lại.`,
            channels: [NotificationChannel.IN_APP],
            metadata: {
              actionUrl: '/admin/companies'
            }
          }).catch(err => console.error('Notify admin error:', err));
        });
      }).catch(err => console.error('Find admins error:', err));
    }

    let responseMessage = 'Cập nhật hồ sơ công ty thành công';
    if (isCrucialInfoChanged && company.verificationStatus === CompanyVerificationStatus.PENDING) {
      responseMessage = 'Cập nhật thành công. Do bạn thay đổi thông tin quan trọng (Tên, Mã số thuế, Giấy phép) nên hồ sơ đang chờ Admin duyệt lại.';
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        id: company._id,
        name: company.name,
        taxCode: company.taxCode,
        website: company.website,
        industries: company.industryIds,
        size: company.size,
        email: company.email,
        phone: company.phone,
        description: company.description,
        avatarUrl: company.avatarUrl,
        coverUrl: company.coverUrl,
        businessLicenseFile: company.businessLicenseFile,
        verificationStatus: company.verificationStatus,
        rejectionReason: company.rejectionReason
      }
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.taxCode) {
      return res.status(400).json({
        success: false,
        message: 'Mã số thuế công ty đã tồn tại'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};



export const submitMyCompanyForVerification = async (req, res) => {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile?.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer has no company'
      });
    }

    const company = await Company.findOne({
      _id: employerProfile.companyId,
      ownerUserId: req.user._id
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found or not owned by this employer'
      });
    }

    if (!company.name || !company.taxCode || !company.industryIds || !company.industryIds.length || !company.size || !company.email || !company.phone || !company.description) {
      return res.status(400).json({
        success: false,
        message: 'Company profile is incomplete'
      });
    }

    if (!company.businessLicenseFile?.fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Business license file is required before submitting for verification'
      });
    }

    if (company.verificationStatus === CompanyVerificationStatus.VERIFIED) {
      return res.status(400).json({
        success: false,
        message: 'Company is already verified'
      });
    }

    company.verificationStatus = CompanyVerificationStatus.PENDING;
    company.rejectionReason = null;
    company.verifiedBy = null;
    company.verifiedAt = null;

    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Company submitted for verification successfully',
      data: {
        id: company._id,
        verificationStatus: company.verificationStatus,
        rejectionReason: company.rejectionReason
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

