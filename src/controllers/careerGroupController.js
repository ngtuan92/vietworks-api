// controllers/careerGroupController.js
import CareerGroup from '../models/careerGroupModels.js';
import Career from '../models/careerModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import Job from '../models/jobModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import mongoose from 'mongoose';

// Lấy danh sách nhóm nghề
export const getCareerGroups = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await CareerGroup.countDocuments(filter);
    const careerGroups = await CareerGroup.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: careerGroups,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết nhóm nghề
export const getCareerGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề' });
    }

    // Đếm số lượng job thuộc nhóm nghề này
    const jobCount = await Job.countDocuments({ careerGroupId: id });
    
    res.status(200).json({
      success: true,
      data: { ...careerGroup.toObject(), jobCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới nhóm nghề
export const createCareerGroup = async (req, res) => {
  try {
    const { name, code, description, order } = req.body;
    
    // Tạo slug từ name
    const slug = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Kiểm tra code và slug đã tồn tại chưa
    const existingCode = await CareerGroup.findOne({ code });
    if (existingCode) {
      return res.status(400).json({ success: false, message: 'Mã nhóm nghề đã tồn tại' });
    }

    const existingSlug = await CareerGroup.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({ success: false, message: 'Tên nhóm nghề đã tồn tại' });
    }

    const careerGroup = await CareerGroup.create({
      name,
      slug,
      code,
      description,
      order: order || 0,
      status: CommonStatus.ACTIVE
    });

    res.status(201).json({
      success: true,
      data: careerGroup,
      message: 'Tạo nhóm nghề thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã nhóm nghề đã tồn tại' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật nhóm nghề
export const updateCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, status, order } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề' });
    }

    // Kiểm tra code trùng (nếu có thay đổi)
    if (code && code !== careerGroup.code) {
      const existingCode = await CareerGroup.findOne({ code, _id: { $ne: id } });
      if (existingCode) {
        return res.status(400).json({ success: false, message: 'Mã nhóm nghề đã tồn tại' });
      }
    }

    // Tạo slug mới nếu tên thay đổi
    let updateData = { description, status, order };
    
    if (name && name !== careerGroup.name) {
      const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const existingSlug = await CareerGroup.findOne({ slug, _id: { $ne: id } });
      if (existingSlug) {
        return res.status(400).json({ success: false, message: 'Tên nhóm nghề đã tồn tại' });
      }
      updateData.name = name;
      updateData.slug = slug;
    }

    if (code) updateData.code = code;

    const updatedCareerGroup = await CareerGroup.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedCareerGroup,
      message: 'Cập nhật nhóm nghề thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã nhóm nghề đã tồn tại' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa mềm (chuyển trạng thái thành INACTIVE)
// controllers/careerGroupController.js

// Xóa mềm (chuyển trạng thái thành INACTIVE) - KHÔNG RÀNG BUỘC
export const softDeleteCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID kh?ng h?p l?' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Kh?ng t?m th?y nh?m ngh?' });
    }

    careerGroup.status = CommonStatus.INACTIVE;
    await careerGroup.save();

    await Career.updateMany(
      { careerGroupId: id, status: { $ne: CommonStatus.INACTIVE } },
      { $set: { status: CommonStatus.INACTIVE } }
    );

    await CareerPosition.updateMany(
      { careerGroupId: id, status: { $ne: CommonStatus.INACTIVE } },
      { $set: { status: CommonStatus.INACTIVE } }
    );

    return res.status(200).json({
      success: true,
      data: careerGroup,
      message: '?? ?n nh?m ngh? th?nh c?ng. C?c ngh? nghi?p v? v? tr? thu?c nh?m n?y c?ng ?? ???c ?n theo.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng (kiểm tra ràng buộc) - VẪN KIỂM TRA JOB
export const hardDeleteCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề' });
    }

    const Career = mongoose.model('Career');
    const CareerPosition = mongoose.model('CareerPosition');
    const jobCount = await Job.countDocuments({ careerGroupId: id });
    const careerCount = await Career.countDocuments({ careerGroupId: id });
    const positionCount = await CareerPosition.countDocuments({ careerGroupId: id });
    const totalReferences = jobCount + careerCount + positionCount;

    if (totalReferences > 0) {
      if (careerGroup.status !== CommonStatus.INACTIVE) {
        careerGroup.status = CommonStatus.INACTIVE;
        await careerGroup.save();
      }

      return res.status(200).json({
        success: true,
        data: careerGroup,
        message: 'Nhóm nghề đã được sử dụng nên được chuyển sang trạng thái ngừng hoạt động để bảo toàn dữ liệu lịch sử'
      });
    }

    await CareerGroup.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Xóa nhóm nghề thành công'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Khôi phục nhóm nghề
export const restoreCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề' });
    }

    if (careerGroup.status === CommonStatus.ACTIVE) {
      return res.status(400).json({ success: false, message: 'Nhóm nghề đã ở trạng thái hoạt động' });
    }

    careerGroup.status = CommonStatus.ACTIVE;
    await careerGroup.save();

    res.status(200).json({
      success: true,
      data: careerGroup,
      message: 'Khôi phục nhóm nghề thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách nhóm nghề đang hoạt động (cho dropdown)
export const getActiveCareerGroups = async (req, res) => {
  try {
    const careerGroups = await CareerGroup.find({ status: CommonStatus.ACTIVE })
      .sort({ order: 1, name: 1 })
      .select('_id name code');

    res.status(200).json({
      success: true,
      data: careerGroups
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật thứ tự hiển thị
export const updateOrder = async (req, res) => {
  try {
    const { orders } = req.body; // [{ id: '...', order: 1 }]

    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'orders phải là một mảng' });
    }

    const updatePromises = orders.map(item => {
      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error(`ID không hợp lệ: ${item.id}`);
      }
      return CareerGroup.findByIdAndUpdate(item.id, { order: item.order }, { new: true });
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Cập nhật thứ tự thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};