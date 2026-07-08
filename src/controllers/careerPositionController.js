// controllers/careerPositionController.js
import CareerPosition from '../models/careerPositionModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import Career from '../models/careerModels.js';
import Job from '../models/jobModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import mongoose from 'mongoose';

// Lấy danh sách vị trí (có phân trang và filter)
export const getCareerPositions = async (req, res) => {
  try {
    const { 
      careerGroupId,
      careerId,
      status, 
      search, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const filter = {};
    if (careerGroupId) filter.careerGroupId = careerGroupId;
    if (careerId) filter.careerId = careerId;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await CareerPosition.countDocuments(filter);
    const positions = await CareerPosition.find(filter)
      .populate('careerGroupId', 'name code')
      .populate('careerId', 'name code')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: positions,
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

// Lấy danh sách vị trí theo nghề (cho dropdown)
export const getPositionsByCareer = async (req, res) => {
  try {
    const { careerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(careerId)) {
      return res.status(400).json({ success: false, message: 'ID nghề không hợp lệ' });
    }

    const positions = await CareerPosition.find({ 
      careerId: careerId,
      status: CommonStatus.ACTIVE 
    })
    .populate('careerGroupId', 'name code')
    .sort({ order: 1, name: 1 })
    .select('_id name code description');

    res.status(200).json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách vị trí theo nhóm nghề
export const getPositionsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ' });
    }

    const positions = await CareerPosition.find({ 
      careerGroupId: groupId,
      status: CommonStatus.ACTIVE 
    })
    .populate('careerId', 'name code')
    .sort({ order: 1, name: 1 })
    .select('_id name code careerId');

    res.status(200).json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết vị trí
export const getCareerPositionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const position = await CareerPosition.findById(id)
      .populate('careerGroupId', 'name code')
      .populate('careerId', 'name code');
    
    if (!position) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }

    // Đếm số lượng job sử dụng vị trí này
    const jobCount = await Job.countDocuments({ careerPositionId: id });

    res.status(200).json({
      success: true,
      data: { ...position.toObject(), jobCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới vị trí
export const createCareerPosition = async (req, res) => {
  try {
    const { 
      careerGroupId,
      careerId,
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

    // Kiểm tra nghề tồn tại và thuộc nhóm
    const career = await Career.findOne({ 
      _id: careerId, 
      careerGroupId: careerGroupId 
    });
    if (!career) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy nghề hoặc nghề không thuộc nhóm này' 
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

    // Kiểm tra slug đã tồn tại trong cùng nghề chưa
    const existingSlug = await CareerPosition.findOne({ 
      slug, 
      careerId 
    });
    if (existingSlug) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên vị trí đã tồn tại trong nghề này' 
      });
    }

    // Kiểm tra code đã tồn tại trong cùng nghề chưa
    const existingCode = await CareerPosition.findOne({ 
      code, 
      careerId 
    });
    if (existingCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã vị trí đã tồn tại trong nghề này' 
      });
    }

    const position = await CareerPosition.create({
      careerGroupId,
      careerId,
      name,
      slug,
      code,
      description,
      order: order || 0,
      status: CommonStatus.ACTIVE
    });

    const populatedPosition = await CareerPosition.findById(position._id)
      .populate('careerGroupId', 'name code')
      .populate('careerId', 'name code');

    res.status(201).json({
      success: true,
      data: populatedPosition,
      message: 'Tạo vị trí thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã vị trí đã tồn tại trong nghề này' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật vị trí
export const updateCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, status, order } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const position = await CareerPosition.findById(id);
    if (!position) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }

    // Kiểm tra code trùng (nếu có thay đổi)
    if (code && code !== position.code) {
      const existingCode = await CareerPosition.findOne({ 
        code, 
        careerId: position.careerId,
        _id: { $ne: id } 
      });
      if (existingCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mã vị trí đã tồn tại trong nghề này' 
        });
      }
    }

    // Tạo slug mới nếu tên thay đổi
    let updateData = { description, status, order };
    
    if (name && name !== position.name) {
      const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const existingSlug = await CareerPosition.findOne({ 
        slug, 
        careerId: position.careerId,
        _id: { $ne: id } 
      });
      if (existingSlug) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tên vị trí đã tồn tại trong nghề này' 
        });
      }
      updateData.name = name;
      updateData.slug = slug;
    }

    if (code) updateData.code = code;

    const updatedPosition = await CareerPosition.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('careerGroupId', 'name code')
     .populate('careerId', 'name code');

    res.status(200).json({
      success: true,
      data: updatedPosition,
      message: 'Cập nhật vị trí thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên hoặc mã vị trí đã tồn tại trong nghề này' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// controllers/careerPositionController.js

// Xóa mềm - KHÔNG RÀNG BUỘC
export const softDeleteCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const position = await CareerPosition.findById(id);
    if (!position) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }

    position.status = CommonStatus.INACTIVE;
    await position.save();

    res.status(200).json({
      success: true,
      data: position,
      message: 'Đã ẩn vị trí thành công. Các job cũ vẫn hiển thị bình thường.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng - VẪN KIỂM TRA
export const hardDeleteCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const position = await CareerPosition.findById(id);
    if (!position) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }

    const jobCount = await Job.countDocuments({ careerPositionId: id });
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vị trí này vì có ${jobCount} công việc đang sử dụng.`
      });
    }

    await CareerPosition.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa vị trí thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Khôi phục vị trí
export const restoreCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const position = await CareerPosition.findById(id);
    if (!position) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí' });
    }

    if (position.status === CommonStatus.ACTIVE) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vị trí đã ở trạng thái hoạt động' 
      });
    }

    // Kiểm tra nghề và nhóm nghề vẫn còn hoạt động
    const career = await Career.findById(position.careerId);
    if (!career || career.status !== CommonStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'Không thể khôi phục vì nghề đã bị ẩn hoặc không tồn tại'
      });
    }

    const careerGroup = await CareerGroup.findById(position.careerGroupId);
    if (!careerGroup || careerGroup.status !== CommonStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'Không thể khôi phục vì nhóm nghề đã bị ẩn hoặc không tồn tại'
      });
    }

    position.status = CommonStatus.ACTIVE;
    await position.save();

    res.status(200).json({
      success: true,
      data: position,
      message: 'Khôi phục vị trí thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách vị trí đang hoạt động (cho dropdown)
export const getActivePositions = async (req, res) => {
  try {
    const { careerId, groupId } = req.query;
    
    const filter = { status: CommonStatus.ACTIVE };
    if (careerId) filter.careerId = careerId;
    if (groupId) filter.careerGroupId = groupId;

    const positions = await CareerPosition.find(filter)
      .populate('careerId', 'name code')
      .populate('careerGroupId', 'name code')
      .sort({ order: 1, name: 1 })
      .select('_id name code careerId careerGroupId');

    res.status(200).json({
      success: true,
      data: positions
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
      return CareerPosition.findByIdAndUpdate(item.id, { order: item.order }, { new: true });
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