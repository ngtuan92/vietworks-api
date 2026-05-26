// controllers/employerAccountController.js
import EmployerProfile from '../models/employerProfileModels.js';
import User from '../models/userModels.js';
import { Gender } from '../enums/masterDataEnums.js';

export const getMyRepresentativeProfile = async (req, res) => {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('representativeName gender phone');

    if (!employerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: employerProfile._id,
        representativeName: employerProfile.representativeName,
        gender: employerProfile.gender,
        phone: employerProfile.phone
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

export const getMyEmployerLoginInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('email authProvider passwordHash')
      .select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        email: user.email,
        authProvider: user.authProvider,
        hasPassword: Boolean(user.passwordHash)
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


export const updateMyRepresentativeProfile = async (req, res) => {
  try {
    const { representativeName, gender, phone } = req.body;

    if (!representativeName || !gender || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Representative name, gender and phone are required'
      });
    }

    if (!Object.values(Gender).includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender'
      });
    }

    const employerProfile = await EmployerProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        representativeName,
        gender,
        phone
      },
      {
        new: true,
        runValidators: true
      }
    ).select('representativeName gender phone');

    if (!employerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Representative profile updated successfully',
      data: {
        id: employerProfile._id,
        representativeName: employerProfile.representativeName,
        gender: employerProfile.gender,
        phone: employerProfile.phone
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

export const updateMyEmployerPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password and confirm new password are required'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm new password does not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.passwordHash = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};