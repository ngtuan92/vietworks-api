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
        message: 'Không tìm thấy hồ sơ nhà tuyển dụng'
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
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
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
        message: 'Không tìm thấy người dùng'
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
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};


export const updateMyRepresentativeProfile = async (req, res) => {
  try {
    const { representativeName, gender, phone } = req.body;

    if (!representativeName || !gender || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Tên người đại diện, giới tính và số điện thoại là bắt buộc'
      });
    }

    if (!Object.values(Gender).includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Giới tính không hợp lệ'
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
        message: 'Không tìm thấy hồ sơ nhà tuyển dụng'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin người đại diện thành công',
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
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};

export const updateMyEmployerPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới là bắt buộc'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Xác nhận mật khẩu mới không khớp'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
      });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác'
      });
    }

    user.passwordHash = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật mật khẩu thành công'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};