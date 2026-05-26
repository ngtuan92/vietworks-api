// controllers/companyLocationController.js
import EmployerProfile from '../models/employerProfileModels.js';
import CompanyLocation from '../models/companyLocationModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';

export const createMyCompanyLocation = async (req, res) => {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }

    if (!employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer has no company'
      });
    }

    const {
      name,
      addressLine,
      province,
      district,
      ward,
      latitude,
      longitude,
      isPrimary
    } = req.body;

    if (!name || !addressLine || !province) {
      return res.status(400).json({
        success: false,
        message: 'Name, address line and province are required'
      });
    }

    if (latitude !== undefined && latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90'
      });
    }

    if (longitude !== undefined && longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be between -180 and 180'
      });
    }

    if (isPrimary) {
      await CompanyLocation.updateMany(
        { companyId: employerProfile.companyId },
        { isPrimary: false }
      );
    }

    const location = await CompanyLocation.create({
      companyId: employerProfile.companyId,
      name,
      addressLine,
      province,
      district: district || null,
      ward: ward || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      isPrimary: Boolean(isPrimary)
    });

    return res.status(201).json({
      success: true,
      message: 'Company location created successfully',
      data: location
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


export const getMyCompanyLocations = async (req, res) => {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }

    if (!employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer has no company'
      });
    }

    const locations = await CompanyLocation.find({
      companyId: employerProfile.companyId,
      status: CommonStatus.ACTIVE
    })
      .select('name addressLine province district ward latitude longitude isPrimary status createdAt updatedAt')
      .sort({ isPrimary: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};