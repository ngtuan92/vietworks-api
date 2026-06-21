import express from 'express';
import * as chatCtrl from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect); // Ensure all routes are protected

// Lấy danh sách hội thoại của user hiện tại
router.get('/conversations', chatCtrl.getConversations);

// Lấy hoặc tạo hội thoại mới (dựa vào applicationId)
router.post('/conversations', chatCtrl.getOrCreateConversation);

// Lấy danh sách tin nhắn của 1 hội thoại
router.get('/conversations/:id/messages', chatCtrl.getMessages);

// Gửi tin nhắn mới
router.post('/conversations/:id/messages', chatCtrl.sendMessage);

// Đánh dấu đã đọc tin nhắn
router.patch('/conversations/:id/read', chatCtrl.markAsRead);

export default router;
