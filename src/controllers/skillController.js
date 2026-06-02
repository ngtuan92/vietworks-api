const Skill = require('../models/skillModels');
const mongoose = require('mongoose');

const getSkillsByCareerGroup = async (req, res) => {
  try {
    const { careerGroupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(careerGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã nhóm nghề (careerGroupId) không đúng định dạng!'
      });
    }

    const skills = await Skill.find({
      careerGroupIds: careerGroupId,
      status: 'ACTIVE'
    })
    .select('name slug aliases') 
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

module.exports = {
  getSkillsByCareerGroup
};