// controllers/companyMasterDataController.js
import CompanyIndustry from '../models/companyIndustryModels.js';
import CompanySize from '../models/companySizeModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';

export const getCompanyIndustries = async (req, res) => {
  try {
    const industries = await CompanyIndustry.find({
      status: CommonStatus.ACTIVE
    })
      .select('name slug status')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: industries.length,
      data: industries
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getCompanySizes = async (req, res) => {
  try {
    const sizes = await CompanySize.find({
      status: CommonStatus.ACTIVE
    })
      .select('code name minEmployees maxEmployees status')
      .sort({ minEmployees: 1 });

    return res.status(200).json({
      success: true,
      count: sizes.length,
      data: sizes
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};