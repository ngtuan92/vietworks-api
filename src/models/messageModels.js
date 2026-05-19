import mongoose from 'mongoose';
import { objectId } from './sharedModels.js';

const messageSchema = new mongoose.Schema({
  conversationId: { type: objectId, ref: 'Conversation', required: true },
  senderId: { type: objectId, ref: 'User', required: true },
  content: { type: String, required: true },
  attachments: {
    type: [{
      fileUrl: String,
      fileName: String,
      fileType: {
        type: String,
        enum: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
      },
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
