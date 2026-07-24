import CareerGroup from '../models/careerGroupModels.js';
import Career from '../models/careerModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import JobLevel from '../models/jobLevelModels.js';

import { CommonStatus } from '../enums/masterDataEnums.js';
import Skill from '../models/skillModels.js';
import mongoose from 'mongoose';

// ==========================================
// 1. QUẢN LÝ NHÓM NGHỀ (CAREER GROUP) - GET
// ==========================================

// [GET] Lấy danh sách nhóm nghề - Mặc định chỉ lấy ACTIVE
export const getCareerGroups = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }

    const groups = await CareerGroup.find(filter).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// 2. QUẢN LÝ NGHỀ (CAREER) - GET
// ==========================================

// [GET] Lấy danh sách nghề - Mặc định chỉ lấy ACTIVE
export const getCareers = async (req, res) => {
  try {
    const { careerGroupId, status } = req.query;
    const filter = {};
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }
    
    if (careerGroupId) filter.careerGroupId = careerGroupId;

    const careers = await Career.find(filter).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: careers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// 3. QUẢN LÝ VỊ TRÍ CHUYÊN MÔN (CAREER POSITION) - GET
// ==========================================

// [GET] Lấy danh sách vị trí - Mặc định chỉ lấy ACTIVE
export const getCareerPositions = async (req, res) => {
  try {
    const { careerGroupId, careerId, status } = req.query;
    const filter = {};
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }
    
    if (careerGroupId) filter.careerGroupId = careerGroupId;
    if (careerId) filter.careerId = careerId;

    const positions = await CareerPosition.find(filter).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: positions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// 4. QUẢN LÝ CẤP BẬC (JOB LEVEL) - GET
// ==========================================

// [GET] Lấy danh sách cấp bậc - Mặc định chỉ lấy ACTIVE
export const getJobLevels = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }

    const levels = await JobLevel.find(filter).sort({ levelOrder: 1 });
    res.status(200).json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// 5. QUẢN LÝ KỸ NĂNG (SKILL) - GET
// ==========================================

// [GET] Lấy danh sách kỹ năng theo Career Group - Mặc định chỉ lấy ACTIVE
export const getSkillsByCareerGroup = async (req, res) => {
  try {
    const { careerGroupId } = req.params;
    const { status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(careerGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã nhóm nghề (careerGroupId) không đúng định dạng!'
      });
    }

    const filter = { careerGroupIds: careerGroupId };
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }

    const skills = await Skill.find(filter)
      .select('name slug aliases status')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra ở hệ thống phía máy chủ!'
    });
  }
};

// [GET] Lấy tất cả kỹ năng - Mặc định chỉ lấy ACTIVE
export const getAllSkills = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    // Nếu không truyền status, mặc định lấy ACTIVE
    if (status) {
      filter.status = status;
    } else {
      filter.status = CommonStatus.ACTIVE;
    }

    const skills = await Skill.find(filter)
      .select('name slug aliases status careerGroupIds')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ==========================================
// CÁC HÀM CRUD KHÁC GIỮ NGUYÊN
// ==========================================

// [POST] Tạo nhóm nghề
export const createCareerGroup = async (req, res) => {
  try {
    const { name, slug, code, description, order } = req.body;

    const existingGroup = await CareerGroup.findOne({ $or: [{ code }, { slug }] });
    if (existingGroup) {
      return res.status(400).json({ success: false, message: 'Mã Code hoặc Slug của nhóm nghề đã tồn tại!' });
    }

    const newGroup = await CareerGroup.create({ name, slug, code, description, order });
    res.status(201).json({ success: true, data: newGroup });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo nhóm nghề', error: error.message });
  }
};

// [PUT] Sửa nhóm nghề
export const updateCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, code, description, order } = req.body;

    const existingGroup = await CareerGroup.findOne({ 
      _id: { $ne: id }, 
      $or: [{ code }, { slug }] 
    });
    if (existingGroup) {
      return res.status(400).json({ success: false, message: 'Mã Code hoặc Slug đã được sử dụng bởi nhóm nghề khác!' });
    }

    const updatedGroup = await CareerGroup.findByIdAndUpdate(
      id,
      { name, slug, code, description, order },
      { new: true, runValidators: true }
    );

    if (!updatedGroup) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề!' });
    res.status(200).json({ success: true, data: updatedGroup });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật', error: error.message });
  }
};

// [DELETE] Ẩn nhóm nghề (Soft Delete)
export const deleteCareerGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedGroup = await CareerGroup.findByIdAndUpdate(
      id,
      { status: CommonStatus.INACTIVE },
      { new: true }
    );

    if (!updatedGroup) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề!' });
    
    await Career.updateMany({ careerGroupId: id }, { status: CommonStatus.INACTIVE });

    res.status(200).json({ success: true, message: 'Đã ẩn nhóm nghề thành công (Bảo toàn lịch sử).' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi ẩn dữ liệu' });
  }
};

// ==========================================
// 2. QUẢN LÝ NGHỀ (CAREER) - CRUD
// ==========================================

export const createCareer = async (req, res) => {
  try {
    const { careerGroupId, name, slug, description, order } = req.body;

    const parentGroup = await CareerGroup.findOne({ _id: careerGroupId, status: CommonStatus.ACTIVE });
    if (!parentGroup) return res.status(400).json({ success: false, message: 'Nhóm nghề cha không tồn tại hoặc đã bị ẩn!' });

    const existingCareer = await Career.findOne({ slug });
    if (existingCareer) return res.status(400).json({ success: false, message: 'Slug nghề này đã tồn tại!' });

    const newCareer = await Career.create({ careerGroupId, name, slug, description, order });
    res.status(201).json({ success: true, data: newCareer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: error.message });
  }
};

export const updateCareer = async (req, res) => {
  try {
    const { id } = req.params;
    const { careerGroupId, name, slug, description, order } = req.body;

    const existingCareer = await Career.findOne({ _id: { $ne: id }, slug });
    if (existingCareer) return res.status(400).json({ success: false, message: 'Slug nghề này đã trùng với nghề khác!' });

    const updatedCareer = await Career.findByIdAndUpdate(
      id,
      { careerGroupId, name, slug, description, order },
      { new: true, runValidators: true }
    );

    if (!updatedCareer) return res.status(404).json({ success: false, message: 'Không tìm thấy nghề cần sửa!' });
    res.status(200).json({ success: true, data: updatedCareer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const deleteCareer = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCareer = await Career.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE }, { new: true });
    
    if (!updatedCareer) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi!' });
    
    await CareerPosition.updateMany({ careerId: id }, { status: CommonStatus.INACTIVE });

    res.status(200).json({ success: true, message: 'Đã ẩn nghề thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

// ==========================================
// 3. QUẢN LÝ VỊ TRÍ CHUYÊN MÔN (CAREER POSITION) - CRUD
// ==========================================

export const createCareerPosition = async (req, res) => {
  try {
    const { careerGroupId, careerId, name, slug, description, order } = req.body;

    if (!mongoose.Types.ObjectId.isValid(careerGroupId) || !mongoose.Types.ObjectId.isValid(careerId)) {
      return res.status(400).json({ success: false, message: 'Định dạng ID Nhóm nghề hoặc Nghề không hợp lệ!' });
    }

    const parentCareer = await Career.findOne({ 
      _id: careerId, 
      careerGroupId: careerGroupId,
      status: CommonStatus.ACTIVE 
    });
    
    if (!parentCareer) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nghề cha không tồn tại, đã bị ẩn hoặc không thuộc Nhóm nghề được chọn!' 
      });
    }

    const existingPosition = await CareerPosition.findOne({ slug });
    if (existingPosition) {
      return res.status(400).json({ success: false, message: 'Slug vị trí chuyên môn này đã tồn tại!' });
    }

    const newPosition = await CareerPosition.create({ 
      careerGroupId, 
      careerId, 
      name, 
      slug, 
      description, 
      order 
    });

    res.status(201).json({ success: true, data: newPosition });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo vị trí chuyên môn', error: error.message });
  }
};

export const updateCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { careerGroupId, careerId, name, slug, description, order } = req.body;

    if (slug) {
      const existingPosition = await CareerPosition.findOne({ _id: { $ne: id }, slug });
      if (existingPosition) {
        return res.status(400).json({ success: false, message: 'Slug này đã được sử dụng bởi vị trí khác!' });
      }
    }

    if (careerId && careerGroupId) {
      const parentCareer = await Career.findOne({ 
        _id: careerId, 
        careerGroupId: careerGroupId,
        status: CommonStatus.ACTIVE 
      });
      if (!parentCareer) {
        return res.status(400).json({ success: false, message: 'Cập nhật thất bại. Nghề cha không hợp lệ hoặc đã bị ẩn!' });
      }
    }

    const updatedPosition = await CareerPosition.findByIdAndUpdate(
      id,
      { careerGroupId, careerId, name, slug, description, order },
      { new: true, runValidators: true }
    );

    if (!updatedPosition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí chuyên môn cần sửa!' });
    }

    res.status(200).json({ success: true, data: updatedPosition });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật vị trí chuyên môn', error: error.message });
  }
};

export const deleteCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedPosition = await CareerPosition.findByIdAndUpdate(
      id,
      { status: CommonStatus.INACTIVE },
      { new: true }
    );

    if (!updatedPosition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí chuyên môn!' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Đã ẩn vị trí chuyên môn thành công. Dữ liệu lịch sử trong CV/Job cũ được bảo toàn.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi ẩn vị trí chuyên môn', error: error.message });
  }
};

// ==========================================
// 4. QUẢN LÝ CẤP BẬC (JOB LEVEL) - CRUD
// ==========================================

export const createJobLevel = async (req, res) => {
  try {
    const { code, name, levelOrder } = req.body;

    const existingLevel = await JobLevel.findOne({ code });
    if (existingLevel) {
      return res.status(400).json({ success: false, message: 'Mã cấp bậc này đã tồn tại trong hệ thống!' });
    }

    const newLevel = await JobLevel.create({ code, name, levelOrder });
    res.status(201).json({ success: true, data: newLevel });
  } catch (error) {
    console.log("=== LỖI THỰC TẾ ĐÂY RỒI: ===", error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống', detail: error.message });
  }
};

export const updateJobLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, levelOrder, status } = req.body;

    const updatedLevel = await JobLevel.findByIdAndUpdate(
      id,
      { name, levelOrder, status },
      { new: true }
    );

    if (!updatedLevel) return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc!' });
    res.status(200).json({ success: true, data: updatedLevel });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const deleteJobLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await JobLevel.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE });
    if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy cấp bậc!' });
    res.status(200).json({ success: true, message: 'Đã ẩn cấp bậc thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

// ==========================================
// 5. QUẢN LÝ KỸ NĂNG (SKILL) - CRUD
// ==========================================

export const createSkill = async (req, res) => {
  try {
    const { name, slug, careerGroupIds, aliases } = req.body;

    const existingSkill = await Skill.findOne({ slug });
    if (existingSkill) return res.status(400).json({ success: false, message: 'Kỹ năng này đã tồn tại!' });

    const newSkill = await Skill.create({ name, slug, careerGroupIds, aliases, status: CommonStatus.ACTIVE });
    res.status(201).json({ success: true, data: newSkill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, careerGroupIds, aliases } = req.body;

    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      { name, slug, careerGroupIds, aliases },
      { new: true }
    );

    if (!updatedSkill) return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ năng!' });
    res.status(200).json({ success: true, data: updatedSkill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;
    await Skill.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE });
    res.status(200).json({ success: true, message: 'Đã ẩn kỹ năng thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};