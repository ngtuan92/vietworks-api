import CareerGroup from '../models/careerGroupModels.js';
import Career from '../models/careerModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import JobLevel from '../models/jobLevelModels.js';
import ExperienceLevel from '../models/experienceLevelModels.js';
import SalaryRange from '../models/salaryRangeModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import Skill from '../models/skillModels.js';
import mongoose from 'mongoose';
// 1. Lấy toàn bộ Nhóm Nghề (Active)
export const getCareerGroups = async (req, res) => {
  try {
    const groups = await CareerGroup.find({ status: CommonStatus.ACTIVE }).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// 2. Lấy Nghề (Có lọc theo careerGroupId nếu frontend truyền lên)
export const getCareers = async (req, res) => {
  try {
    const { careerGroupId } = req.query;
    const filter = { status: CommonStatus.ACTIVE };
    
    if (careerGroupId) {
      filter.careerGroupId = careerGroupId;
    }

    const careers = await Career.find(filter).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: careers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// 3. Lấy Vị trí chuyên môn (Có lọc theo careerGroupId hoặc careerId)
export const getCareerPositions = async (req, res) => {
  try {
    const { careerGroupId, careerId } = req.query;
    const filter = { status: CommonStatus.ACTIVE };

    if (careerGroupId) filter.careerGroupId = careerGroupId;
    if (careerId) filter.careerId = careerId;

    const positions = await CareerPosition.find(filter).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, data: positions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};



export const getJobLevels = async (req, res) => {
  try {
    const filter = { status: CommonStatus.ACTIVE };

    // Sắp xếp theo thứ tự cấp bậc tăng dần (levelOrder: 1)
    const levels = await JobLevel.find(filter).sort({ levelOrder: 1 });
    res.status(200).json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// 5. Lấy danh sách Kinh nghiệm (Global - Không cần lọc theo ngành)
export const getExperienceLevels = async (req, res) => {
  try {
    // Sắp xếp theo số năm kinh nghiệm tối thiểu từ nhỏ đến lớn
    const experiences = await ExperienceLevel.find({ status: CommonStatus.ACTIVE }).sort({ minYear: 1 });
    res.status(200).json({ success: true, data: experiences });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getSkillsByCareerGroup = async (req, res) => {
  try {
    const { careerGroupId } = req.params;

    // 1. Kiểm tra xem Id truyền lên có đúng định dạng ObjectId của MongoDB không
    if (!mongoose.Types.ObjectId.isValid(careerGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã nhóm nghề (careerGroupId) không đúng định dạng!'
      });
    }

    // 2. Tìm các kỹ năng có trạng thái ACTIVE và thuộc nhóm nghề được truyền vào
    // Mongoose tự hiểu careerGroupIds là mảng và tự tìm kiếm phần tử khớp bên trong mảng đó
    const skills = await Skill.find({
      careerGroupIds: careerGroupId,
      status: 'ACTIVE'
    })
    .select('name slug aliases') // Chỉ lấy ra các trường cần thiết cho nhẹ băng thông
    .sort({ name: 1 }); // Sắp xếp theo thứ tự bảng chữ cái A-Z từ tên skill

    // 3. Trả kết quả về cho Frontend
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



export const createCareerGroup = async (req, res) => {
  try {
    const { name, slug, code, description, order } = req.body;

    // Kiểm tra trùng mã code hoặc slug
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

    // Kiểm tra trùng code/slug với các bản ghi khác ngoại trừ chính nó
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

    // Thay vì xóa cứng, ta chuyển trạng thái sang INACTIVE
    const updatedGroup = await CareerGroup.findByIdAndUpdate(
      id,
      { status: CommonStatus.INACTIVE },
      { new: true }
    );

    if (!updatedGroup) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm nghề!' });
    
    // Tùy chọn: Khi ẩn nhóm nghề, có thể ẩn luôn các nghề (Career) thuộc nhóm này
    await Career.updateMany({ careerGroupId: id }, { status: CommonStatus.INACTIVE });

    res.status(200).json({ success: true, message: 'Đã ẩn nhóm nghề thành công (Bảo toàn lịch sử).' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi ẩn dữ liệu' });
  }
};


// ==========================================
// 2. QUẢN LÝ NGHỀ (CAREER)
// ==========================================

export const createCareer = async (req, res) => {
  try {
    const { careerGroupId, name, slug, description, order } = req.body;

    // Kiểm tra nhóm nghề cha có tồn tại và đang active không
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
    
    // Tự động ẩn các Vị trí chuyên môn (CareerPosition) thuộc nghề này
    await CareerPosition.updateMany({ careerId: id }, { status: CommonStatus.INACTIVE });

    res.status(200).json({ success: true, message: 'Đã ẩn nghề thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};


// ==========================================
// 5. QUẢN LÝ VỊ TRÍ CHUYÊN MÔN (CAREER POSITION)
// ==========================================

// [POST] Thêm Vị trí chuyên môn mới
export const createCareerPosition = async (req, res) => {
  try {
    const { careerGroupId, careerId, name, slug, description, order } = req.body;

    // 1. Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(careerGroupId) || !mongoose.Types.ObjectId.isValid(careerId)) {
      return res.status(400).json({ success: false, message: 'Định dạng ID Nhóm nghề hoặc Nghề không hợp lệ!' });
    }

    // 2. Kiểm tra tính tồn tại và trạng thái của Nghề (Career) thuộc Nhóm nghề đó
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

    // 3. Kiểm tra trùng lặp Slug của Vị trí chuyên môn
    const existingPosition = await CareerPosition.findOne({ slug });
    if (existingPosition) {
      return res.status(400).json({ success: false, message: 'Slug vị trí chuyên môn này đã tồn tại!' });
    }

    // 4. Tạo mới dữ liệu gốc chuẩn
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

// [PUT] Sửa Vị trí chuyên môn
export const updateCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { careerGroupId, careerId, name, slug, description, order } = req.body;

    // 1. Kiểm tra trùng slug với các vị trí khác (ngoại trừ chính nó)
    if (slug) {
      const existingPosition = await CareerPosition.findOne({ _id: { $ne: id }, slug });
      if (existingPosition) {
        return res.status(400).json({ success: false, message: 'Slug này đã được sử dụng bởi vị trí khác!' });
      }
    }

    // 2. Nếu thay đổi cấu trúc cha (careerId), cần check lại tính hợp lệ
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

    // 3. Tiến hành cập nhật (Giữ nguyên ID, chỉ đổi thông tin hiển thị)
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

// [DELETE] Ẩn Vị trí chuyên môn thay vì xóa cứng (Soft Delete)
export const deleteCareerPosition = async (req, res) => {
  try {
    const { id } = req.params;

    // Chuyển status sang INACTIVE để bảo toàn dữ liệu cho Job/CV cũ đã dùng ID này
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
// 3. QUẢN LÝ CẤP BẬC (JOB LEVEL)
// ==========================================

export const createJobLevel = async (req, res) => {
  try {
    const { code, name, levelOrder } = req.body;

    // Kiểm tra trùng code cấp bậc trên toàn hệ thống
    const existingLevel = await JobLevel.findOne({ code });
    if (existingLevel) {
      return res.status(400).json({ success: false, message: 'Mã cấp bậc này đã tồn tại trong hệ thống!' });
    }

    const newLevel = await JobLevel.create({ code, name, levelOrder });
    res.status(201).json({ success: true, data: newLevel });
  } catch (error) {
console.log("=== LỖI THỰC TẾ ĐÂY RỒI: ===", error); // <-- Thêm dòng này
  res.status(500).json({ success: false, message: 'Lỗi hệ thống', detail: error.message });  }
};

export const updateJobLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, levelOrder, status } = req.body; 
    // KHÔNG cho phép sửa 'code' và 'careerGroupId' bừa bãi để tránh gãy logic Job cũ đang chạy bậc đó.

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
    await JobLevel.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE });
    res.status(200).json({ success: true, message: 'Đã ẩn cấp bậc thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};


// ==========================================
// 4. QUẢN LÝ KỸ NĂNG (SKILL / TAG)
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




// ==========================================
// 6. QUẢN LÝ MỨC KINH NGHIỆM (EXPERIENCE LEVEL)
// ==========================================

// [POST] Thêm mới Mức kinh nghiệm
export const createExperienceLevel = async (req, res) => {
  try {
    const { code, name, minYear, maxYear } = req.body;

    // 1. Kiểm tra trùng Unique Code
    const existingExp = await ExperienceLevel.findOne({ code });
    if (existingExp) {
      return res.status(400).json({ 
        success: false, 
        message: `Mã định danh kinh nghiệm '${code}' đã tồn tại!` 
      });
    }

    // 2. Validate logic số năm kinh nghiệm cơ bản
    if (maxYear !== null && minYear > maxYear) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số năm kinh nghiệm tối thiểu không được lớn hơn số năm tối đa!' 
      });
    }

    // 3. Tiến hành tạo mới dữ liệu gốc
    const newExp = await ExperienceLevel.create({
      code,
      name,
      minYear,
      maxYear,
      status: CommonStatus.ACTIVE
    });

    res.status(201).json({ success: true, data: newExp });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo mức kinh nghiệm', error: error.message });
  }
};

// [PUT] Sửa Mức kinh nghiệm
export const updateExperienceLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, minYear, maxYear, status } = req.body; 
    // KHÔNG cho phép sửa 'code' để bảo vệ logic lịch sử của Job/CV cũ

    // Validate logic số năm nếu có truyền lên
    if (minYear !== undefined && maxYear !== undefined && maxYear !== null) {
      if (minYear > maxYear) {
        return res.status(400).json({ success: false, message: 'Số năm tối thiểu không được lớn hơn số năm tối đa!' });
      }
    }

    const updatedExp = await ExperienceLevel.findByIdAndUpdate(
      id,
      { name, minYear, maxYear, status },
      { new: true, runValidators: true }
    );

    if (!updatedExp) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mức kinh nghiệm cần sửa!' });
    }

    res.status(200).json({ success: true, data: updatedExp });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật mức kinh nghiệm', error: error.message });
  }
};

// ==========================================
// 7. KHOẢNG LƯƠNG (SALARY RANGE)
// ==========================================

export const getSalaryRanges = async (req, res) => {
  try {
    const ranges = await SalaryRange.find({ status: CommonStatus.ACTIVE })
      .select('code name minMillion maxMillion currency')
      .lean();

    return res.status(200).json({ success: true, data: ranges });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// [DELETE] Ẩn mức kinh nghiệm (Soft Delete)
export const deleteExperienceLevel = async (req, res) => {
  try {
    const { id } = req.params;

    // Thay vì xóa cứng, ta chuyển trạng thái sang INACTIVE để giữ an toàn dữ liệu lịch sử
    const updatedExp = await ExperienceLevel.findByIdAndUpdate(
      id,
      { status: CommonStatus.INACTIVE },
      { new: true }
    );

    if (!updatedExp) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mức kinh nghiệm!' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Đã ẩn mức kinh nghiệm thành công. Dữ liệu cũ trong hệ thống được bảo toàn.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi ẩn mức kinh nghiệm' });
  }
};





