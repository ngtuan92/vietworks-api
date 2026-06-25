import { askAiChatbot } from '../services/aiChatbotService.js';

export const sendAiChatMessage = async (req, res) => {
  try {
    const { message, messages } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung cần hỏi chatbot.'
      });
    }

    const data = await askAiChatbot({
      message: String(message).trim(),
      messages: Array.isArray(messages) ? messages : []
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('AI chatbot error:', error.response?.data || error.message);
    const statusCode = error.statusCode || error.response?.status || 500;
    const providerMessage = error.response?.data?.error?.message || error.message;

    let message = 'Chatbot AI đang bận hoặc cấu hình chưa đúng. Vui lòng thử lại sau.';
    if (error.statusCode === 503 && !error.response) {
      message = error.message;
    } else if (statusCode === 429) {
      message = `AI provider đang giới hạn request hoặc tài khoản/project đã hết quota: ${providerMessage}`;
    } else if (statusCode === 503) {
      message = 'Dịch vụ AI đang quá tải hoặc tạm thời không sẵn sàng. Bạn thử lại sau ít phút nhé.';
    } else if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      message = `Cấu hình AI provider chưa hợp lệ: ${providerMessage}`;
    }

    return res.status(statusCode).json({
      success: false,
      message
    });
  }
};
