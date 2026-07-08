// controllers/skillController.js
import Skill from '../models/skillModels.js';
import Job from '../models/jobModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import mongoose from 'mongoose';

// Lấy danh sách kỹ năng (có phân trang và filter)
export const getSkills = async (req, res) => {
  try {
    const { 
      careerGroupId,
      status, 
      search, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const filter = {};
    if (careerGroupId) filter.careerGroupIds = careerGroupId;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { aliases: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Skill.countDocuments(filter);
    const skills = await Skill.find(filter)
      .populate('careerGroupIds', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: skills,
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

// Lấy danh sách kỹ năng theo nhóm nghề
export const getSkillsByCareerGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ' });
    }

    const skills = await Skill.find({ 
      careerGroupIds: { $in: [groupId] },
      status: 'ACTIVE'
    })
    .populate('careerGroupIds', 'name code')
    .sort({ name: 1 })
    .select('_id name aliases');

    res.status(200).json({
      success: true,
      data: skills
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách kỹ năng đang hoạt động (cho dropdown)
export const getActiveSkills = async (req, res) => {
  try {
    const { careerGroupId } = req.query;
    
    const filter = { status: 'ACTIVE' };
    if (careerGroupId) filter.careerGroupIds = { $in: [careerGroupId] };

    const skills = await Skill.find(filter)
      .populate('careerGroupIds', 'name code')
      .sort({ name: 1 })
      .select('_id name aliases careerGroupIds');

    res.status(200).json({
      success: true,
      data: skills
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết kỹ năng
export const getSkillById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const skill = await Skill.findById(id).populate('careerGroupIds', 'name code');
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng' });
    }

    // Đếm số lượng job sử dụng kỹ năng này
    const jobCount = await Job.countDocuments({ 
      skills: { $in: [id] }
    });

    res.status(200).json({
      success: true,
      data: { ...skill.toObject(), jobCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới kỹ năng
export const createSkill = async (req, res) => {
  try {
    const { 
      name, 
      aliases, 
      careerGroupIds,
      status 
    } = req.body;

    // Kiểm tra careerGroupIds có tồn tại không
    if (careerGroupIds && careerGroupIds.length > 0) {
      const existingGroups = await CareerGroup.find({
        _id: { $in: careerGroupIds }
      });
      
      if (existingGroups.length !== careerGroupIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Một số nhóm nghề không tồn tại'
        });
      }
    }

    // Tạo slug từ name
    const slug = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Kiểm tra slug đã tồn tại chưa
    const existingSlug = await Skill.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        message: 'Tên kỹ năng đã tồn tại'
      });
    }

    // Xử lý aliases
    const processedAliases = aliases 
      ? aliases.filter(a => a && a.trim()).map(a => a.trim().toLowerCase())
      : [];

    const skill = await Skill.create({
      name,
      slug,
      aliases: processedAliases,
      careerGroupIds: careerGroupIds || [],
      status: status || 'ACTIVE'
    });

    const populatedSkill = await Skill.findById(skill._id).populate('careerGroupIds', 'name code');

    res.status(201).json({
      success: true,
      data: populatedSkill,
      message: 'Tạo kỹ năng thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Tên kỹ năng đã tồn tại'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật kỹ năng
export const updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, aliases, careerGroupIds, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const skill = await Skill.findById(id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng' });
    }

    // Kiểm tra careerGroupIds
    if (careerGroupIds && careerGroupIds.length > 0) {
      const existingGroups = await CareerGroup.find({
        _id: { $in: careerGroupIds }
      });
      
      if (existingGroups.length !== careerGroupIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Một số nhóm nghề không tồn tại'
        });
      }
    }

    const updateData = {};
    let slugChanged = false;

    if (name && name !== skill.name) {
      const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const existingSlug = await Skill.findOne({ 
        slug, 
        _id: { $ne: id } 
      });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: 'Tên kỹ năng đã tồn tại'
        });
      }
      updateData.name = name;
      updateData.slug = slug;
      slugChanged = true;
    }

    if (aliases !== undefined) {
      updateData.aliases = aliases.filter(a => a && a.trim()).map(a => a.trim().toLowerCase());
    }

    if (careerGroupIds !== undefined) {
      updateData.careerGroupIds = careerGroupIds;
    }

    if (status) updateData.status = status;

    // Update updatedAt
    updateData.updatedAt = new Date();

    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('careerGroupIds', 'name code');

    res.status(200).json({
      success: true,
      data: updatedSkill,
      message: 'Cập nhật kỹ năng thành công'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Tên kỹ năng đã tồn tại'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// controllers/skillController.js

// Xóa mềm - KHÔNG RÀNG BUỘC
export const softDeleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const skill = await Skill.findById(id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng' });
    }

    skill.status = 'INACTIVE';
    skill.updatedAt = new Date();
    await skill.save();

    res.status(200).json({
      success: true,
      data: skill,
      message: 'Đã ẩn kỹ năng thành công. Các job cũ vẫn hiển thị bình thường.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa cứng - VẪN KIỂM TRA
export const hardDeleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const skill = await Skill.findById(id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng' });
    }

    const jobCount = await Job.countDocuments({ skills: { $in: [id] } });
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa kỹ năng này vì có ${jobCount} công việc đang sử dụng.`
      });
    }

    await Skill.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa kỹ năng thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Khôi phục kỹ năng
export const restoreSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const skill = await Skill.findById(id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng' });
    }

    if (skill.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Kỹ năng đã ở trạng thái hoạt động'
      });
    }

    skill.status = 'ACTIVE';
    skill.updatedAt = new Date();
    await skill.save();

    res.status(200).json({
      success: true,
      data: skill,
      message: 'Khôi phục kỹ năng thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật nhiều kỹ năng cùng lúc
export const bulkUpdateSkills = async (req, res) => {
  try {
    const { skills } = req.body; // [{ id: '...', status: 'ACTIVE' }]

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: 'skills phải là một mảng'
      });
    }

    const updatePromises = skills.map(item => {
      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error(`ID không hợp lệ: ${item.id}`);
      }
      return Skill.findByIdAndUpdate(
        item.id,
        { 
          status: item.status,
          updatedAt: new Date()
        },
        { new: true }
      );
    });

    const updatedSkills = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      data: updatedSkills,
      message: 'Cập nhật kỹ năng thành công'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};