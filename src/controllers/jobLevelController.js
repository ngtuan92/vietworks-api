// controllers/jobLevelController.js
import JobLevel from '../models/jobLevelModels.js';
import Job from '../models/jobModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import mongoose from 'mongoose';

// Lấy danh sách cấp bậc (có phân trang và filter)
export const getJobLevels = async (req, res) => {
  try {
    const { 
      status, 
      search, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await JobLevel.countDocuments(filter);
    const jobLevels = await JobLevel.find(filter)
      .sort({ levelOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: jobLevels,
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

// Lấy danh sách cấp bậc đang hoạt động (cho dropdown)
export const getActiveJobLevels = async (req, res) => {
  try {
    const jobLevels = await JobLevel.find({ 
      status: CommonStatus.ACTIVE 
    })
    .sort({ levelOrder: 1, name: 1 })
    .select('_id name code levelOrder');

    res.status(200).json({
      success: true,
      data: jobLevels
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết cấp bậc
export const getJobLevelById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const jobLevel = await JobLevel.findById(id);
    if (!jobLevel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc' });
    }

    // Đếm số lượng job sử dụng cấp bậc này
    const jobCount = await Job.countDocuments({ jobLevelId: id });

    res.status(200).json({
      success: true,
      data: { ...jobLevel.toObject(), jobCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới cấp bậc
export const createJobLevel = async (req, res) => {
  try {
    const { 
      code, 
      name, 
      levelOrder,
      status 
    } = req.body;

    // Kiểm tra code đã tồn tại chưa
    const existingCode = await JobLevel.findOne({ code });
    if (existingCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã cấp bậc đã tồn tại' 
      });
    }

    // Kiểm tra levelOrder đã tồn tại chưa
    const existingOrder = await JobLevel.findOne({ levelOrder });
    if (existingOrder) {
      return res.status(400).json({ 
        success: false, 
        message: `Thứ tự ${levelOrder} đã được sử dụng. Vui lòng chọn thứ tự khác.` 
      });
    }

    const jobLevel = await JobLevel.create({
      code,
      name,
      levelOrder,
      status: status || CommonStatus.ACTIVE
    });

    res.status(201).json({
      success: true,
      data: jobLevel,
      message: 'Tạo cấp bậc thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã hoặc thứ tự cấp bậc đã tồn tại' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật cấp bậc
export const updateJobLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, levelOrder, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const jobLevel = await JobLevel.findById(id);
    if (!jobLevel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc' });
    }

    // Kiểm tra code trùng (nếu có thay đổi)
    if (code && code !== jobLevel.code) {
      const existingCode = await JobLevel.findOne({ 
        code, 
        _id: { $ne: id } 
      });
      if (existingCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mã cấp bậc đã tồn tại' 
        });
      }
    }

    // Kiểm tra levelOrder trùng (nếu có thay đổi)
    if (levelOrder && levelOrder !== jobLevel.levelOrder) {
      const existingOrder = await JobLevel.findOne({ 
        levelOrder, 
        _id: { $ne: id } 
      });
      if (existingOrder) {
        return res.status(400).json({ 
          success: false, 
          message: `Thứ tự ${levelOrder} đã được sử dụng. Vui lòng chọn thứ tự khác.` 
        });
      }
    }

    const updateData = {};
    if (code) updateData.code = code;
    if (name) updateData.name = name;
    if (levelOrder !== undefined) updateData.levelOrder = levelOrder;
    if (status) updateData.status = status;

    const updatedJobLevel = await JobLevel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedJobLevel,
      message: 'Cập nhật cấp bậc thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã hoặc thứ tự cấp bậc đã tồn tại' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// controllers/jobLevelController.js

// Xóa mềm - KHÔNG RÀNG BUỘC
export const softDeleteJobLevel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const jobLevel = await JobLevel.findById(id);
    if (!jobLevel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc' });
    }

    jobLevel.status = CommonStatus.INACTIVE;
    await jobLevel.save();

    res.status(200).json({
      success: true,
      data: jobLevel,
      message: 'Đã ẩn cấp bậc thành công. Các job cũ vẫn hiển thị bình thường.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng - VẪN KIỂM TRA
export const hardDeleteJobLevel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const jobLevel = await JobLevel.findById(id);
    if (!jobLevel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc' });
    }

    const jobCount = await Job.countDocuments({ jobLevelId: id });
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa cấp bậc này vì có ${jobCount} công việc đang sử dụng.`
      });
    }

    await JobLevel.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa cấp bậc thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Khôi phục cấp bậc
export const restoreJobLevel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const jobLevel = await JobLevel.findById(id);
    if (!jobLevel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc' });
    }

    if (jobLevel.status === CommonStatus.ACTIVE) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cấp bậc đã ở trạng thái hoạt động' 
      });
    }

    jobLevel.status = CommonStatus.ACTIVE;
    await jobLevel.save();

    res.status(200).json({
      success: true,
      data: jobLevel,
      message: 'Khôi phục cấp bậc thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật thứ tự hiển thị (batch update)
export const updateOrder = async (req, res) => {
  try {
    const { orders } = req.body; // [{ id: '...', levelOrder: 1 }]

    if (!Array.isArray(orders)) {
      return res.status(400).json({ 
        success: false, 
        message: 'orders phải là một mảng' 
      });
    }

    // Kiểm tra các levelOrder có bị trùng không
    const orderValues = orders.map(item => item.levelOrder);
    const uniqueOrders = new Set(orderValues);
    if (orderValues.length !== uniqueOrders.size) {
      return res.status(400).json({
        success: false,
        message: 'Các thứ tự không được trùng nhau'
      });
    }

    const updatePromises = orders.map(item => {
      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error(`ID không hợp lệ: ${item.id}`);
      }
      return JobLevel.findByIdAndUpdate(item.id, { levelOrder: item.levelOrder }, { new: true });
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