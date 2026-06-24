import axios from 'axios';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

const VIETWORKS_CONTEXT = `
Thông tin hệ thống VietWorks:
- VietWorks là nền tảng tuyển dụng gồm 3 nhóm chính: ứng viên, nhà tuyển dụng và admin.
- Khách vãng lai có thể xem/tìm kiếm việc làm, xem chi tiết việc làm, xem công ty. Khi muốn ứng tuyển, lưu việc, theo dõi công ty, tạo/quản lý CV hoặc dùng tính năng cá nhân hóa thì cần đăng nhập/đăng ký.
- Ứng viên có thể đăng ký/đăng nhập bằng email, Google hoặc LinkedIn, xác minh email, quên mật khẩu, cập nhật hồ sơ, đổi mật khẩu, cài đặt thông báo và quyền riêng tư.
- Ứng viên có thể tìm việc theo từ khóa, công ty, địa điểm, ngành nghề, kinh nghiệm, lương, cấp bậc và nhiều bộ lọc khác.
- Ứng viên có thể xem chi tiết việc làm, lưu việc, ứng tuyển bằng CV online hoặc CV đã tải lên, xem việc đã lưu, việc đã ứng tuyển và việc phù hợp.
- VietWorks có CV Builder: chọn mẫu CV, chỉnh font, màu, bố cục, avatar, kéo thả section, chỉnh nội dung, tự động lưu, xem trước và xuất PDF.
- Ứng viên có thể quản lý CV online và CV upload: tạo, sửa, đổi tên, xóa, tải xuống và đặt CV chính.
- Tính năng AI Review CV dùng để phân tích CV, chấm điểm, so khớp với JD và gợi ý cải thiện CV.
- Ứng viên có thể mua gói dịch vụ như Boost CV/Top CV bằng ví/thanh toán để tăng khả năng hiển thị.
- Nhà tuyển dụng có khu vực riêng để đăng ký/đăng nhập, xác minh email, quản lý hồ sơ công ty, địa điểm, giấy tờ xác minh, đăng tin tuyển dụng, quản lý ứng viên, tìm kiếm CV trong talent pool và mua gói dịch vụ.
- Admin quản lý người dùng, công ty, duyệt công ty, duyệt tin tuyển dụng, mẫu CV, gói dịch vụ, giao dịch, hóa đơn, thông báo, dữ liệu master và báo cáo thống kê.
- Chat thường của hệ thống là kênh ứng viên nhắn tin với nhà tuyển dụng. VietWorks AI là chatbot hỗ trợ hướng dẫn sử dụng hệ thống, tìm việc, CV và các luồng cơ bản.

Quy tắc trả lời theo hệ thống:
- Nếu người dùng hỏi cách thao tác, trả lời theo các bước trên giao diện VietWorks, ưu tiên đường dẫn/chức năng thật.
- Nếu tính năng chưa chắc có trong hệ thống, nói rõ là "hiện hệ thống có thể chưa hỗ trợ trực tiếp" và gợi ý cách thay thế.
- Không khẳng định trạng thái tài khoản, số dư ví, hồ sơ, đơn hàng, CV hoặc tin tuyển dụng cụ thể nếu người dùng chưa cung cấp dữ liệu.
- Không hướng dẫn người dùng vào trang admin trừ khi họ nói rõ họ là admin.
`;

const buildSystemInstruction = () => `
Bạn là VietWorks AI, trợ lý AI chính thức của hệ thống VietWorks.
Luôn trả lời bằng tiếng Việt có dấu, tự nhiên, ngắn gọn, thân thiện và sát với hệ thống VietWorks.
Không trả lời như một chatbot tuyển dụng chung chung. Hãy dựa vào phần "Thông tin hệ thống VietWorks" dưới đây.

${VIETWORKS_CONTEXT}
`;

const normalizeChatHistory = (messages = []) => messages
  .slice(-8)
  .filter((item) => item?.content && ['user', 'assistant'].includes(item.role))
  .map((item) => ({
    role: item.role,
    content: String(item.content).slice(0, 2000)
  }));

const normalizeGeminiHistory = (messages = []) => normalizeChatHistory(messages)
  .map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));

const askGemini = async ({ message, messages = [] }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CHAT_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    const error = new Error('Thiếu GEMINI_API_KEY trong file .env của backend.');
    error.statusCode = 503;
    throw error;
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }]
    },
    contents: [
      ...normalizeGeminiHistory(messages),
      {
        role: 'user',
        parts: [{ text: String(message).slice(0, 4000) }]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 700
    }
  };

  const response = await axios.post(
    `${GEMINI_API_URL}/${model}:generateContent`,
    payload,
    {
      params: { key: apiKey },
      timeout: 30000
    }
  );

  const reply = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('AI không trả về nội dung phù hợp.');
  }

  return {
    reply,
    model,
    provider: 'gemini'
  };
};

const askGroq = async ({ message, messages = [] }) => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_CHAT_MODEL || DEFAULT_GROQ_MODEL;

  if (!apiKey) {
    const error = new Error('Thiếu GROQ_API_KEY trong file .env của backend.');
    error.statusCode = 503;
    throw error;
  }

  const response = await axios.post(
    GROQ_CHAT_COMPLETIONS_URL,
    {
      model,
      messages: [
        { role: 'system', content: buildSystemInstruction() },
        ...normalizeChatHistory(messages),
        { role: 'user', content: String(message).slice(0, 4000) }
      ],
      temperature: 0.25,
      max_tokens: 700
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('AI không trả về nội dung phù hợp.');
  }

  return {
    reply,
    model,
    provider: 'groq'
  };
};

export const askAiChatbot = async ({ message, messages = [] }) => {
  const provider = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase();

  if (provider === 'groq') {
    return askGroq({ message, messages });
  }

  if (provider === 'gemini_groq' || provider === 'auto') {
    try {
      return await askGemini({ message, messages });
    } catch (error) {
      const shouldFallbackToGroq = Boolean(process.env.GROQ_API_KEY);

      if (!shouldFallbackToGroq) {
        throw error;
      }

      console.warn('Gemini chatbot failed, falling back to Groq:', error.response?.data || error.message);
      return askGroq({ message, messages });
    }
  }

  return askGemini({ message, messages });
};
