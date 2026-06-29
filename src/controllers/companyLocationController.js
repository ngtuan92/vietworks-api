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
        message: 'Không tìm thấy hồ sơ nhà tuyển dụng'
      });
    }

    if (!employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Nhà tuyển dụng chưa có công ty'
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
        message: 'Tên địa điểm, địa chỉ chi tiết và tỉnh/thành phố là bắt buộc'
      });
    }

    if (latitude !== undefined && latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({
        success: false,
        message: 'Vĩ độ phải nằm trong khoảng -90 đến 90'
      });
    }

    if (longitude !== undefined && longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({
        success: false,
        message: 'Kinh độ phải nằm trong khoảng -180 đến 180'
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
      message: 'Tạo địa điểm công ty thành công',
      data: location
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
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
        message: 'Không tìm thấy hồ sơ nhà tuyển dụng'
      });
    }

    if (!employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Nhà tuyển dụng chưa có công ty'
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
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};

export const updateMyCompanyLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile?.companyId) {
      return res.status(400).json({ success: false, message: 'Nhà tuyển dụng chưa có công ty' });
    }

    const { name, addressLine, province, district, ward, latitude, longitude, isPrimary } = req.body;

    if (!name || !addressLine || !province) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    const location = await CompanyLocation.findOne({ _id: id, companyId: employerProfile.companyId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm' });
    }

    if (isPrimary && !location.isPrimary) {
      await CompanyLocation.updateMany({ companyId: employerProfile.companyId }, { isPrimary: false });
    }

    location.name = name;
    location.addressLine = addressLine;
    location.province = province;
    location.district = district || null;
    location.ward = ward || null;
    location.latitude = latitude ?? null;
    location.longitude = longitude ?? null;
    if (isPrimary !== undefined) location.isPrimary = Boolean(isPrimary);

    await location.save();

    return res.status(200).json({ success: true, message: 'Cập nhật địa điểm thành công', data: location });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const deleteMyCompanyLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const employerProfile = await EmployerProfile.findOne({
      userId: req.user._id
    }).select('companyId');

    if (!employerProfile?.companyId) {
      return res.status(400).json({ success: false, message: 'Nhà tuyển dụng chưa có công ty' });
    }

    const location = await CompanyLocation.findOneAndDelete({ _id: id, companyId: employerProfile.companyId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm' });
    }

    return res.status(200).json({ success: true, message: 'Xóa địa điểm thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};