import Conversation from '../models/conversationModels.js';
import Message from '../models/messageModels.js';
import Application from '../models/applicationModels.js';
import { getIO } from '../sockets/chatSocket.js';
import notificationService from '../services/notificationService.js';
import { UserRole } from '../enums/userEnums.js';

// 1. Get or Create Conversation
export const getOrCreateConversation = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }

    const application = await Application.findById(applicationId).populate('jobId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Hồ sơ ứng tuyển không tồn tại' });
    }

    const jobseekerId = application.jobseekerUserId;
    const employerId = application.jobId.employerId;

    // Verify participant
    if (userRole === UserRole.JOBSEEKER && jobseekerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }
    if (userRole === UserRole.EMPLOYER && employerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({ applicationId });

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [
          { userId: jobseekerId, role: UserRole.JOBSEEKER },
          { userId: employerId, role: UserRole.EMPLOYER }
        ],
        jobId: application.jobId._id,
        applicationId: application._id
      });
    }

    // Populate participant info
    conversation = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'fullName avatar email')
      .populate({
        path: 'jobId',
        select: 'title companyId',
        populate: { path: 'companyId', select: 'companyName logo' }
      });

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// 2. Get User's Conversations
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Conversation.find({ 'participants.userId': userId })
      .populate('participants.userId', 'fullName avatar email')
      .populate({
        path: 'jobId',
        select: 'title companyId',
        populate: { path: 'companyId', select: 'companyName logo' }
      })
      .sort({ lastMessageAt: -1 });

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// 3. Get Messages
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findOne({
      _id: id,
      'participants.userId': userId
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại' });
    }

    const messages = await Message.find({ conversationId: id })
      .populate('senderId', 'fullName avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// 4. Send Message
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user.id;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      'participants.userId': userId
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại' });
    }

    const newMessage = await Message.create({
      conversationId: id,
      senderId: userId,
      content,
      attachments: attachments || [],
      readBy: [{ userId, readAt: new Date() }]
    });

    await newMessage.populate('senderId', 'fullName avatar');

    // Update conversation last message
    conversation.lastMessage = content || (attachments?.length ? 'Đã gửi một tệp đính kèm' : 'Tin nhắn mới');
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Emit socket event
    const io = getIO();
    io.to(id).emit('new_message', newMessage);

    // Notify other participant if they are not reading (Offline notification)
    const receiver = conversation.participants.find(p => p.userId.toString() !== userId.toString());
    if (receiver) {
      await notificationService.create({
        userId: receiver.userId,
        type: 'NEW_MESSAGE',
        title: 'Tin nhắn mới',
        content: `Bạn có tin nhắn mới trong một cuộc hội thoại`,
        relatedId: id,
        relatedModel: 'Conversation'
      });
    }

    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// 5. Mark Messages as Read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      {
        conversationId: id,
        'readBy.userId': { $ne: userId }
      },
      {
        $push: { readBy: { userId, readAt: new Date() } }
      }
    );

    // Emit socket event
    const io = getIO();
    io.to(id).emit('messages_read', { conversationId: id, userId });

    res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
