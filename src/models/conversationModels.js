import mongoose from 'mongoose';
import { UserRole } from '../enums/userEnums.js';
import { objectId } from './sharedModels.js';

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      userId: { type: objectId, ref: 'User', required: true },
      role: { type: String, enum: [UserRole.JOBSEEKER, UserRole.EMPLOYER], required: true }
    }],
    default: []
  },
  jobId: { type: objectId, ref: 'Job', default: null },
  applicationId: { type: objectId, ref: 'Application', default: null },
  lastMessage: { type: String, default: null },
  lastMessageAt: { type: Date, default: null }
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations');
export default Conversation;
