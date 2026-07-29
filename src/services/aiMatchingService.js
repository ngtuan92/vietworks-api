import axios from 'axios';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_INSTRUCTION = `
Bạn là một chuyên gia tuyển dụng cao cấp của hệ thống tuyển dụng VietWorks. 
Nhiệm vụ của bạn là phân tích văn bản CV của ứng viên và đối khớp với danh sách các công việc đang tuyển dụng được cung cấp.

Hãy đánh giá mức độ tương thích dựa trên kỹ năng, kinh nghiệm làm việc, học vấn và các thế mạnh khác trong CV so với mô tả công việc (JD) và yêu cầu công việc.
Không bị ràng buộc cứng nhắc bởi khoảng cách địa lý hay kinh nghiệm tối thiểu nếu ứng viên có kỹ năng vượt trội hoặc phù hợp với công việc.

Bắt buộc trả về kết quả dưới dạng một MẢNG JSON hợp lệ. Không thêm bất kỳ lời dẫn, giải thích hay định dạng markdown nào ngoài JSON. Chỉ trả về chuỗi JSON thô có dạng:
[
  {
    "jobId": "ID của công việc",
    "matchScore": <số nguyên từ 0 đến 100>,
    "reason": "Lý do gợi ý ngắn gọn bằng tiếng Việt (1-2 câu)"
  }
]
Chỉ giữ lại các công việc có matchScore từ 50 trở lên. Sắp xếp kết quả theo matchScore giảm dần.
`;

const cleanAndParseJson = (text) => {
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const parsed = JSON.parse(cleanText.trim());
    return Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.results || []);
  } catch (err) {
    console.error('Failed to parse AI JSON:', err, 'Original text:', text);
    throw new Error('AI phản hồi định dạng không hợp lệ');
  }
};

const matchWithGemini = async (cvText, jobsList) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CHAT_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    throw new Error('Thiếu GEMINI_API_KEY');
  }

  const prompt = `
Dưới đây là văn bản CV của ứng viên:
=== NỘI DUNG CV ===
${cvText}
==================

Dưới đây là danh sách các công việc đang tuyển dụng:
=== DANH SÁCH CÔNG VIỆC ===
${JSON.stringify(jobsList, null, 2)}
===========================

Hãy thực hiện so khớp và trả về mảng JSON kết quả phù hợp nhất.
`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await axios.post(
    `${GEMINI_API_URL}/${model}:generateContent`,
    payload,
    {
      params: { key: apiKey },
      timeout: 40000
    }
  );

  const reply = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('AI không phản hồi');
  }

  return cleanAndParseJson(reply);
};

const matchWithGroq = async (cvText, jobsList) => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_CHAT_MODEL || DEFAULT_GROQ_MODEL;

  if (!apiKey) {
    throw new Error('Thiếu GROQ_API_KEY');
  }

  const prompt = `
Dưới đây là văn bản CV của ứng viên:
=== NỘI DUNG CV ===
${cvText}
==================

Dưới đây là danh sách các công việc đang tuyển dụng:
=== DANH SÁCH CÔNG VIỆC ===
${JSON.stringify(jobsList, null, 2)}
===========================

Hãy thực hiện so khớp và trả về mảng JSON kết quả phù hợp nhất theo định dạng yêu cầu trong system instruction.
`;

  const response = await axios.post(
    GROQ_CHAT_COMPLETIONS_URL,
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 40000
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('AI không phản hồi');
  }

  return cleanAndParseJson(reply);
};

export const matchCvWithJobs = async (cvText, jobsList) => {
  const provider = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase();

  if (provider === 'groq') {
    return matchWithGroq(cvText, jobsList);
  }

  if (provider === 'gemini_groq' || provider === 'auto') {
    try {
      return await matchWithGemini(cvText, jobsList);
    } catch (error) {
      const shouldFallbackToGroq = Boolean(process.env.GROQ_API_KEY);
      if (!shouldFallbackToGroq) {
        throw error;
      }
      console.warn('Gemini matching failed, falling back to Groq:', error.message);
      return matchWithGroq(cvText, jobsList);
    }
  }

  return matchWithGemini(cvText, jobsList);
};

const ATS_SCREEN_SYSTEM_INSTRUCTION = `
Bạn là một chuyên gia tuyển dụng cao cấp (ATS screener) của hệ thống tuyển dụng VietWorks.
Nhiệm vụ của bạn là phân tích văn bản CV của ứng viên so với mô tả công việc (JD) và các yêu cầu tuyển dụng được cung cấp.

Hãy đánh giá mức độ tương thích (%) và đưa ra lý do phù hợp khách quan.
Bắt buộc trả về kết quả dưới dạng một đối tượng JSON hợp lệ. Không thêm bất kỳ lời dẫn, giải thích hay định dạng markdown nào ngoài JSON. Chỉ trả về chuỗi JSON thô có dạng:
{
  "matchScore": <số nguyên từ 0 đến 100>,
  "reason": "Giải thích ngắn gọn lý do vì sao ứng viên đạt số điểm đó bằng tiếng Việt (1-2 câu, tối đa 50 từ)"
}
`;

const cleanAndParseSingleJson = (text) => {
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleanText.trim());
  } catch (err) {
    console.error('Failed to parse AI single JSON:', err, 'Original text:', text);
    throw new Error('AI phản hồi định dạng không hợp lệ');
  }
};

const screenWithGemini = async (cvText, jobDetails) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CHAT_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    throw new Error('Thiếu GEMINI_API_KEY');
  }

  const prompt = `
Dưới đây là văn bản CV của ứng viên:
=== NỘI DUNG CV ===
${cvText}
==================

Dưới đây là chi tiết công việc tuyển dụng:
=== CHI TIẾT CÔNG VIỆC ===
Tiêu đề: ${jobDetails.title}
Mô tả công việc: ${jobDetails.description}
Yêu cầu công việc: ${jobDetails.requirements}
==========================

Hãy đánh giá mức độ tương thích (%) và đưa ra lý do phù hợp khách quan theo định dạng JSON yêu cầu.
`;

  const payload = {
    systemInstruction: {
      parts: [{ text: ATS_SCREEN_SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await axios.post(
    `${GEMINI_API_URL}/${model}:generateContent`,
    payload,
    {
      params: { key: apiKey },
      timeout: 40000
    }
  );

  const reply = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('AI không phản hồi');
  }

  return cleanAndParseSingleJson(reply);
};

const screenWithGroq = async (cvText, jobDetails) => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_CHAT_MODEL || DEFAULT_GROQ_MODEL;

  if (!apiKey) {
    throw new Error('Thiếu GROQ_API_KEY');
  }

  const prompt = `
Dưới đây là văn bản CV của ứng viên:
=== NỘI DUNG CV ===
${cvText}
==================

Dưới đây là chi tiết công việc tuyển dụng:
=== CHI TIẾT CÔNG VIỆC ===
Tiêu đề: ${jobDetails.title}
Mô tả công việc: ${jobDetails.description}
Yêu cầu công việc: ${jobDetails.requirements}
==========================

Hãy thực hiện đánh giá mức độ tương thích (%) và đưa ra lý do phù hợp khách quan theo định dạng JSON yêu cầu trong system instruction.
`;

  const response = await axios.post(
    GROQ_CHAT_COMPLETIONS_URL,
    {
      model,
      messages: [
        { role: 'system', content: ATS_SCREEN_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 40000
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('AI không phản hồi');
  }

  return cleanAndParseSingleJson(reply);
};

export const screenCvWithJob = async (cvText, jobDetails) => {
  const provider = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase();

  if (provider === 'groq') {
    return screenWithGroq(cvText, jobDetails);
  }

  if (provider === 'gemini_groq' || provider === 'auto') {
    try {
      return await screenWithGemini(cvText, jobDetails);
    } catch (error) {
      const shouldFallbackToGroq = Boolean(process.env.GROQ_API_KEY);
      if (!shouldFallbackToGroq) {
        throw error;
      }
      console.warn('Gemini screening failed, falling back to Groq:', error.message);
      return screenWithGroq(cvText, jobDetails);
    }
  }

  return screenWithGemini(cvText, jobDetails);
};
