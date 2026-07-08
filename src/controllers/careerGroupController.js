// controllers/careerGroupController.js
import CareerGroup from '../models/careerGroupModels.js';
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
export const softDeleteCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const careerGroup = await CareerGroup.findById(id);
    if (!careerGroup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề' });
    }

    // Kiểm tra xem có job nào đang sử dụng nhóm nghề này không
    const jobCount = await Job.countDocuments({ 
      careerGroupId: id,
      status: { $in: ['PUBLISHED', 'PENDING', 'DRAFT'] } // Các trạng thái không cho phép xóa
    });

    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa nhóm nghề này vì có ${jobCount} công việc đang sử dụng. Vui lòng chuyển đổi hoặc xóa các công việc này trước.`
      });
    }

    careerGroup.status = CommonStatus.INACTIVE;
    await careerGroup.save();

    res.status(200).json({
      success: true,
      data: careerGroup,
      message: 'Đã vô hiệu hóa nhóm nghề thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng (kiểm tra ràng buộc)
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

    // Kiểm tra xem có bất kỳ job nào sử dụng nhóm nghề này không (tất cả trạng thái)
    const jobCount = await Job.countDocuments({ careerGroupId: id });
    
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa nhóm nghề này vì có ${jobCount} công việc đang sử dụng (bao gồm cả công việc đã xóa). Vui lòng xóa hoặc chuyển đổi tất cả công việc này trước.`
      });
    }

    await CareerGroup.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa nhóm nghề thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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