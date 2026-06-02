import CareerGroup from '../models/careerGroupModels.js'; // Giả định bạn đã có model này
import Career from '../models/careerModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import JobLevel from '../models/jobLevelModels.js';
import ExperienceLevel from '../models/experienceLevelModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import Skill from '../models/skillModels.js';
import mongoose from 'mongoose'; // Đường dẫn tới file Schema ở trên
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
    const { careerGroupId } = req.query;
    const filter = { status: CommonStatus.ACTIVE };

    // Nếu frontend truyền careerGroupId lên thì mới lọc, không thì trả về hết hoặc rỗng tùy bạn
    if (careerGroupId) {
      filter.careerGroupId = careerGroupId;
    }

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

