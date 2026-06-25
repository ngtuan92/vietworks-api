import express from 'express';
import { sendAiChatMessage } from '../controllers/aiChatbotController.js';

const router = express.Router();

router.post('/chat', sendAiChatMessage);

export default router;
