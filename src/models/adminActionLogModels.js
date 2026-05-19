import mongoose from 'mongoose';
import { AdminAction, AdminTargetType } from '../enums/adminEnums.js';
import { objectId } from './sharedModels.js';

const adminActionLogSchema = new mongoose.Schema({
  adminId: { type: objectId, ref: 'User', required: true },
  action: { type: String, enum: Object.values(AdminAction), required: true },
  targetType: { type: String, enum: Object.values(AdminTargetType), required: true },
  targetId: { type: objectId, required: true },
  reason: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

const AdminActionLog = mongoose.model('AdminActionLog', adminActionLogSchema, 'admin_action_logs');
export default AdminActionLog;
