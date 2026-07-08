import Conversation from '../models/conversationModels.js';
import Message from '../models/messageModels.js';
import Application from '../models/applicationModels.js';
import { getIO } from '../sockets/chatSocket.js';
import notificationService from '../services/notificationService.js';
import { UserRole } from '../enums/userEnums.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';

import UnlockedCandidate from '../models/unlockedCandidateModels.js';

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const attachJobseekerAvatarsToConversations = async (payload) => {
  const conversations = Array.isArray(payload) ? payload : [payload];
  const jobseekerIds = conversations
    .flatMap((conversation) => conversation?.participants || [])
    .filter((participant) => participant?.role === UserRole.JOBSEEKER && participant?.userId)
    .map((participant) => toId(participant.userId));

  const uniqueIds = [...new Set(jobseekerIds)].filter(Boolean);
  if (!uniqueIds.length) return payload;

  const profiles = await JobseekerProfile.find({ userId: { $in: uniqueIds } }).select('userId avatarUrl').lean();
  const avatarByUserId = new Map(profiles.map((profile) => [toId(profile.userId), profile.avatarUrl]));

  conversations.forEach((conversation) => {
    conversation?.participants?.forEach((participant) => {
      if (participant?.role !== UserRole.JOBSEEKER || !participant?.userId) return;
      const avatarUrl = avatarByUserId.get(toId(participant.userId));
      if (avatarUrl) participant.userId.avatar = avatarUrl;
    });
  });

  return payload;
};

const attachJobseekerAvatarsToMessages = async (messages) => {
  const senderIds = messages.map((message) => toId(message.senderId)).filter(Boolean);
  const profiles = await JobseekerProfile.find({ userId: { $in: [...new Set(senderIds)] } }).select('userId avatarUrl').lean();
  const avatarByUserId = new Map(profiles.map((profile) => [toId(profile.userId), profile.avatarUrl]));

  messages.forEach((message) => {
    const avatarUrl = avatarByUserId.get(toId(message.senderId));
    if (avatarUrl && message.senderId) message.senderId.avatar = avatarUrl;
  });

  return messages;
};

import EmployerProfile from '../models/employerProfileModels.js';

const attachEmployerCompaniesToConversations = async (payload) => {
  const conversations = Array.isArray(payload) ? payload : [payload];
  const employerIds = conversations
    .flatMap((conversation) => conversation?.participants || [])
    .filter((participant) => participant?.role === UserRole.EMPLOYER && participant?.userId)
    .map((participant) => toId(participant.userId?._id || participant.userId));

  const uniqueIds = [...new Set(employerIds)].filter(Boolean);
  if (!uniqueIds.length) return payload;

  const profiles = await EmployerProfile.find({ userId: { $in: uniqueIds } }).populate('companyId').lean();
  const companyByEmployerId = new Map(profiles.map((profile) => [toId(profile.userId), profile.companyId]));

  conversations.forEach((conversation) => {
    if (!conversation.jobId) {
      conversation.participants?.forEach((participant) => {
        if (participant?.role === UserRole.EMPLOYER && participant?.userId) {
          const company = companyByEmployerId.get(toId(participant.userId?._id || participant.userId));
          if (company) {
            conversation.companyId = company;
          }
        }
      });
    }
  });

  return payload;
};

// 1. Get or Create Conversation
export const getOrCreateConversation = async (req, res) => {
  try {
    const { applicationId, jobseekerId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!applicationId && !jobseekerId) {
      return res.status(400).json({ success: false, message: 'Yêu cầu applicationId hoặc jobseekerId' });
    }

    let conversation;

    // NHÁNH 1: Đi từ Hồ sơ ứng tuyển (Application)
    if (applicationId) {
      const application = await Application.findById(applicationId).populate('jobId');
      if (!application) {
        return res.status(404).json({ success: false, message: 'Hồ sơ ứng tuyển không tồn tại' });
      }

      const appJobseekerId = application.jobseekerUserId;
      const employerId = application.jobId.createdBy;

      // Verify participant
      if (userRole === UserRole.JOBSEEKER && appJobseekerId.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
      }
      if (userRole === UserRole.EMPLOYER && employerId.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
      }

      conversation = await Conversation.findOne({ applicationId });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [
            { userId: appJobseekerId, role: UserRole.JOBSEEKER },
            { userId: employerId, role: UserRole.EMPLOYER }
          ],
          jobId: application.jobId._id,
          applicationId: application._id
        });
      }
    } 
    // NHÁNH 2: Đi từ Talent Pool (Unlocked Candidate)
    else if (jobseekerId) {
      if (userRole !== UserRole.EMPLOYER) {
        return res.status(403).json({ success: false, message: 'Chỉ nhà tuyển dụng mới có thể chủ động tạo hội thoại từ Talent Pool' });
      }

      // Check if unlocked
      const unlocked = await UnlockedCandidate.findOne({
        employerId: userId,
        candidateId: jobseekerId
      });

      if (!unlocked) {
        return res.status(403).json({ success: false, message: 'Bạn cần mở khóa CV để chat với ứng viên này' });
      }

      // Find existing conversation without applicationId between these two users
      conversation = await Conversation.findOne({
        applicationId: null,
        'participants.userId': { $all: [userId, jobseekerId] }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [
            { userId: jobseekerId, role: UserRole.JOBSEEKER },
            { userId: userId, role: UserRole.EMPLOYER }
          ],
          jobId: null,
          applicationId: null
        });
      }
    }

    // Populate participant info
    const conversationDoc = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'fullName avatar email')
      .populate({
        path: 'jobId',
        select: 'title companyId',
        populate: { path: 'companyId', select: 'name avatarUrl' }
      });

    const conversationData = conversationDoc.toObject();
    await attachJobseekerAvatarsToConversations(conversationData);
    await attachEmployerCompaniesToConversations(conversationData);

    res.status(200).json({ success: true, data: conversationData });
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
        populate: { path: 'companyId', select: 'name avatarUrl' }
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    await attachJobseekerAvatarsToConversations(conversations);
    await attachEmployerCompaniesToConversations(conversations);

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Conversation.find({ 'participants.userId': userId }).select('_id').lean();
    const conversationIds = conversations.map((conversation) => conversation._id);

    if (!conversationIds.length) {
      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const unreadCount = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId }
    });

    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải số tin nhắn chưa đọc' });
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
      .sort({ createdAt: 1 })
      .lean();

    await attachJobseekerAvatarsToMessages(messages);

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// 4. Send Message
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content = '', attachments = [] } = req.body;
    const userId = req.user.id;
    const safeContent = typeof content === 'string' ? content.trim() : '';
    const safeAttachments = Array.isArray(attachments)
      ? attachments
          .filter((file) => file?.fileUrl)
          .map((file) => ({
            fileUrl: file.fileUrl,
            fileName: file.fileName || 'Tệp đính kèm',
            fileType: file.fileType || 'application/octet-stream',
            fileSize: Number(file.fileSize) || 0
          }))
      : [];

    if (!safeContent && safeAttachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tin nhắn hoặc chọn tệp đính kèm' });
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
      content: safeContent,
      attachments: safeAttachments,
      readBy: [{ userId, readAt: new Date() }]
    });

    await newMessage.populate('senderId', 'fullName avatar');
    const messageData = newMessage.toObject();
    await attachJobseekerAvatarsToMessages([messageData]);

    // Update conversation last message
    conversation.lastMessage = safeContent || (safeAttachments.length ? 'Đã gửi một tệp đính kèm' : 'Tin nhắn mới');
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Emit socket event
    const io = getIO();
    const receiver = conversation.participants.find(p => p.userId.toString() !== userId.toString());
    
    if (receiver) {
      io.to(id).to(receiver.userId.toString()).emit('new_message', messageData);
    } else {
      io.to(id).emit('new_message', messageData);
    }

    // Notify other participant if they are not reading (Offline notification)
    if (receiver) {
      await notificationService.create({
        receiverUserId: receiver.userId,
        typeCode: 'NEW_MESSAGE',
        title: 'Tin nhắn mới',
        content: `Bạn có tin nhắn mới trong một cuộc hội thoại`,
        metadata: {
          conversationId: id
        }
      });
    }

    res.status(201).json({ success: true, data: messageData });
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



