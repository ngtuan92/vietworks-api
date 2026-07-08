// controllers/careerController.js
import Career from '../models/careerModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import Job from '../models/jobModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import mongoose from 'mongoose';

// Lấy danh sách nghề (có phân trang và filter)
export const getCareers = async (req, res) => {
  try {
    const { 
      careerGroupId, 
      status, 
      search, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const filter = {};
    if (careerGroupId) filter.careerGroupId = careerGroupId;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Career.countDocuments(filter);
    const careers = await Career.find(filter)
      .populate('careerGroupId', 'name code')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: careers,
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

// Lấy danh sách nghề theo nhóm (cho dropdown)
export const getCareersByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ' });
    }

    const careers = await Career.find({ 
      careerGroupId: groupId,
      status: CommonStatus.ACTIVE 
    })
    .sort({ order: 1, name: 1 })
    .select('_id name code description');

    res.status(200).json({
      success: true,
      data: careers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết nghề
export const getCareerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const career = await Career.findById(id).populate('careerGroupId', 'name code');
    if (!career) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nghề' });
    }

    // Đếm số lượng job thuộc nghề này
    const jobCount = await Job.countDocuments({ careerId: id });

    res.status(200).json({
      success: true,
      data: { ...career.toObject(), jobCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới nghề
export const createCareer = async (req, res) => {
  try {
    const { 
      careerGroupId, 
      name, 
      code, 
      description, 
      order 
    } = req.body;

    // Kiểm tra nhóm nghề tồn tại
    const careerGroup = await CareerGroup.findById(careerGroupId);
    if (!careerGroup) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy nhóm nghề' 
      });
    }

    // Tạo slug từ name
    const slug = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Kiểm tra slug đã tồn tại trong cùng nhóm chưa
    const existingSlug = await Career.findOne({ 
      slug, 
      careerGroupId 
    });
    if (existingSlug) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên nghề đã tồn tại trong nhóm này' 
      });
    }

    // Kiểm tra code đã tồn tại trong cùng nhóm chưa
    const existingCode = await Career.findOne({ 
      code, 
      careerGroupId 
    });
    if (existingCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã nghề đã tồn tại trong nhóm này' 
      });
    }

    const career = await Career.create({
      careerGroupId,
      name,
      slug,
      code,
      description,
      order: order || 0,
      status: CommonStatus.ACTIVE
    });

    const populatedCareer = await Career.findById(career._id).populate('careerGroupId', 'name code');

    res.status(201).json({
      success: true,
      data: populatedCareer,
      message: 'Tạo nghề thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã nghề đã tồn tại trong nhóm này' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật nghề
export const updateCareer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, status, order } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const career = await Career.findById(id);
    if (!career) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nghề' });
    }

    // Kiểm tra code trùng (nếu có thay đổi)
    if (code && code !== career.code) {
      const existingCode = await Career.findOne({ 
        code, 
        careerGroupId: career.careerGroupId,
        _id: { $ne: id } 
      });
      if (existingCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mã nghề đã tồn tại trong nhóm này' 
        });
      }
    }

    // Tạo slug mới nếu tên thay đổi
    let updateData = { description, status, order };
    
    if (name && name !== career.name) {
      const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const existingSlug = await Career.findOne({ 
        slug, 
        careerGroupId: career.careerGroupId,
        _id: { $ne: id } 
      });
      if (existingSlug) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tên nghề đã tồn tại trong nhóm này' 
        });
      }
      updateData.name = name;
      updateData.slug = slug;
    }

    if (code) updateData.code = code;

    const updatedCareer = await Career.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('careerGroupId', 'name code');

    res.status(200).json({
      success: true,
      data: updatedCareer,
      message: 'Cập nhật nghề thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã nghề đã tồn tại trong nhóm này' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// controllers/careerController.js

// Xóa mềm (chuyển trạng thái thành INACTIVE) - KHÔNG RÀNG BUỘC
export const softDeleteCareer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const career = await Career.findById(id);
    if (!career) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nghề' });
    }

    // KHÔNG KIỂM TRA JOB, vẫn cho phép ẩn
    career.status = CommonStatus.INACTIVE;
    await career.save();

    res.status(200).json({
      success: true,
      data: career,
      message: 'Đã ẩn nghề thành công. Các job cũ vẫn hiển thị bình thường.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng (kiểm tra ràng buộc) - VẪN KIỂM TRA
export const hardDeleteCareer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const career = await Career.findById(id);
    if (!career) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nghề' });
    }

    // Kiểm tra Job
    const jobCount = await Job.countDocuments({ careerId: id });
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa nghề này vì có ${jobCount} công việc đang sử dụng.`
      });
    }

    // Kiểm tra CareerPosition
    const CareerPosition = mongoose.model('CareerPosition');
    const positionCount = await CareerPosition.countDocuments({ careerId: id });
    if (positionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa nghề này vì có ${positionCount} vị trí chuyên môn đang sử dụng.`
      });
    }

    await Career.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa nghề thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Khôi phục nghề
export const restoreCareer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const career = await Career.findById(id);
    if (!career) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nghề' });
    }

    if (career.status === CommonStatus.ACTIVE) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nghề đã ở trạng thái hoạt động' 
      });
    }

    // Kiểm tra nhóm nghề vẫn còn hoạt động
    const careerGroup = await CareerGroup.findById(career.careerGroupId);
    if (!careerGroup || careerGroup.status !== CommonStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'Không thể khôi phục vì nhóm nghề đã bị ẩn hoặc không tồn tại'
      });
    }

    career.status = CommonStatus.ACTIVE;
    await career.save();

    res.status(200).json({
      success: true,
      data: career,
      message: 'Khôi phục nghề thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách nghề đang hoạt động (cho dropdown)
export const getActiveCareers = async (req, res) => {
  try {
    const { groupId } = req.query;
    
    const filter = { status: CommonStatus.ACTIVE };
    if (groupId) filter.careerGroupId = groupId;

    const careers = await Career.find(filter)
      .populate('careerGroupId', 'name code')
      .sort({ order: 1, name: 1 })
      .select('_id name code careerGroupId');

    res.status(200).json({
      success: true,
      data: careers
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
      return res.status(400).json({ 
        success: false, 
        message: 'orders phải là một mảng' 
      });
    }

    const updatePromises = orders.map(item => {
      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error(`ID không hợp lệ: ${item.id}`);
      }
      return Career.findByIdAndUpdate(item.id, { order: item.order }, { new: true });
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