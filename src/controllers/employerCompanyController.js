import EmployerProfile from '../models/employerProfileModels.js';
import Company from '../models/companyModels.js';
import CompanyLocation from '../models/companyLocationModels.js';
import { CommonStatus,  CompanyVerificationStatus
 } from '../enums/masterDataEnums.js';

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
      .select('name taxCode website industryId sizeId email phone description avatarUrl coverUrl verificationStatus rejectionReason businessLicenseFile')
      .populate('industryId', 'name slug')
      .populate('sizeId', 'code name minEmployees maxEmployees');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
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
        industry: company.industryId,
        size: company.sizeId,
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
      message: 'Server error',
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
      industryId,
      sizeId,
      email,
      phone,
      avatarUrl,
      coverUrl,
      description,
      businessLicenseFile
    } = req.body;

    if (!name || !taxCode || !industryId || !sizeId || !email || !phone || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, tax code, industry, size, email, phone and description are required'
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

    const updateData = {
      name,
      taxCode,
      website: website || null,
      industryId,
      sizeId,
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
}).select('businessLicenseFile verificationStatus');

if (!currentCompany) {
  return res.status(404).json({
    success: false,
    message: 'Company not found or not owned by this employer'
  });
}

if (businessLicenseFile !== undefined) {
  const oldFileUrl = currentCompany.businessLicenseFile?.fileUrl || null;
  const newFileUrl = businessLicenseFile?.fileUrl || null;
  const isBusinessLicenseChanged = oldFileUrl !== newFileUrl;

  updateData.businessLicenseFile = businessLicenseFile || null;

  if (isBusinessLicenseChanged) {
    updateData.rejectionReason = null;
    updateData.verifiedBy = null;
    updateData.verifiedAt = null;

    if (currentCompany.verificationStatus === CompanyVerificationStatus.VERIFIED) {
      updateData.verificationStatus = CompanyVerificationStatus.PENDING;
    }

    if (currentCompany.verificationStatus === CompanyVerificationStatus.REJECTED) {
      updateData.verificationStatus = CompanyVerificationStatus.UNVERIFIED;
    }

    if (currentCompany.verificationStatus === CompanyVerificationStatus.PENDING) {
      updateData.verificationStatus = CompanyVerificationStatus.PENDING;
    }
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
      .populate('industryId', 'name slug')
      .populate('sizeId', 'code name minEmployees maxEmployees');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found or not owned by this employer'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company profile updated successfully',
      data: {
        id: company._id,
        name: company.name,
        taxCode: company.taxCode,
        website: company.website,
        industry: company.industryId,
        size: company.sizeId,
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
        message: 'Company tax code already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
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

    if (!company.name || !company.taxCode || !company.industryId || !company.sizeId || !company.email || !company.phone || !company.description) {
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