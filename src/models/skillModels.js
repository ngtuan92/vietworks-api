import mongoose from 'mongoose';
import { CommonStatus } from '../enums/masterDataEnums.js';

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  aliases: { type: [String], default: [] },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const Skill = mongoose.model('Skill', skillSchema, 'skills');
export default Skill;
