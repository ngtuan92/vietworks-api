import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  aliases: [{ type: String }],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  // Mảng chứa các Id của nhóm nghề liên quan
  careerGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CareerGroup'
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 👉 QUAN TRỌNG: Tạo index cho mảng careerGroupIds để tối ưu tốc độ tìm kiếm (Multikey Index)
skillSchema.index({ careerGroupIds: 1, status: 1 });

const Skill = mongoose.model('Skill', skillSchema,'skills');
export default Skill;