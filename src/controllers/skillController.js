const Skill = require('../models/skillModels'); // Đường dẫn tới file Schema ở trên
const mongoose = require('mongoose');

const getSkillsByCareerGroup = async (req, res) => {
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

module.exports = {
  getSkillsByCareerGroup
};