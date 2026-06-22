import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const messageSchema = new mongoose.Schema({
  conversationId: { type: objectId, ref: 'Conversation', required: true },
  senderId: { type: objectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  attachments: {
    type: [{
      fileUrl: String,
      fileName: String,
      fileType: String,
      fileSize: Number
    }],
    default: []
  },
  readBy: {
    type: [{
      userId: { type: objectId, ref: 'User', required: true },
      readAt: { type: Date, required: true }
    }],
    default: []
  }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema, 'messages');
export default Message;

