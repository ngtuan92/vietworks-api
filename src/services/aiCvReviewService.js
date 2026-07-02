import axios from 'axios';
import { PDFParse } from 'pdf-parse';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

const LEVEL_ORDER = ['intern', 'junior', 'middle', 'senior', 'lead', 'manager'];
const LEVEL_LABELS = {
  intern: 'Thực tập sinh/Fresher',
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  lead: 'Lead/Trưởng nhóm',
  manager: 'Manager/Quản lý'
};

const LEVEL_EXPERIENCE = {
  intern: { min: 0, ideal: 0.5, max: 1 },
  junior: { min: 1, ideal: 1.5, max: 2 },
  middle: { min: 2, ideal: 3, max: 4 },
  senior: { min: 4, ideal: 5, max: 6 },
  lead: { min: 5, ideal: 6.5, max: 8 },
  manager: { min: 6, ideal: 8, max: 12 }
};

const SCORE_WEIGHTS = {
  skills: 0.5,
  experience: 0.3,
  levelFit: 0.2
};

const MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9+#.\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeList = (items) => {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = normalizeText(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(Number(value) || 0, min), max);

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCurrentYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
};

const extractDateRefs = (text) => {
  const normalized = normalizeText(text);
  const refs = [];
  const monthYearRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+((?:19|20)\d{2})\b/g;

  for (const match of normalized.matchAll(monthYearRegex)) {
    refs.push({
      year: Number(match[2]),
      month: MONTH_INDEX[match[1]] || 12,
      hasMonth: true
    });
  }

  for (const match of normalized.matchAll(/\b((?:19|20)\d{2})\b/g)) {
    const year = Number(match[1]);
    if (!refs.some((ref) => ref.year === year)) {
      refs.push({ year, month: 12, hasMonth: false });
    }
  }

  return refs;
};

const isPastOrCurrentDateRef = (ref, current) => (
  ref.year < current.year
  || (ref.year === current.year && (!ref.hasMonth || ref.month <= current.month))
);

const isInvalidFutureDateFlag = (flag) => {
  const normalized = normalizeText(flag);
  const mentionsFutureDate = /\b(tuong lai|future|sau thoi gian|moc thoi gian)\b/.test(normalized);

  if (!mentionsFutureDate) return false;

  const refs = extractDateRefs(flag);
  if (!refs.length) return false;

  return refs.every((ref) => isPastOrCurrentDateRef(ref, getCurrentYearMonth()));
};

const filterRedFlags = (items) => normalizeList(items)
  .filter((flag) => !isInvalidFutureDateFlag(flag));

const inferLevelFromText = (value = '') => {
  const text = normalizeText(value);

  if (/\b(manager|quan ly|head|director|truong phong)\b/.test(text)) return 'manager';
  if (/\b(lead|leader|tech lead|team lead|truong nhom)\b/.test(text)) return 'lead';
  if (/\b(senior|sr\.?)\b/.test(text)) return 'senior';
  if (/\b(mid|middle|intermediate)\b/.test(text)) return 'middle';
  if (/\b(junior|jr\.?|nhan vien)\b/.test(text)) return 'junior';
  if (/\b(intern|fresher|thuc tap|moi ra truong)\b/.test(text)) return 'intern';

  return 'middle';
};

const inferLevelFromYears = (years) => {
  if (years >= 6) return 'manager';
  if (years >= 5) return 'lead';
  if (years >= 4) return 'senior';
  if (years >= 2) return 'middle';
  if (years >= 1) return 'junior';
  return 'intern';
};

const normalizeLevel = (level, fallbackText = '', years = 0) => {
  const normalized = normalizeText(level);
  const matchedLevel = LEVEL_ORDER.find((item) => normalized.includes(item));

  if (matchedLevel) return matchedLevel;
  if (fallbackText) return inferLevelFromText(fallbackText);
  return inferLevelFromYears(years);
};

const getTier = (score) => {
  if (score >= 80) return 'Highly Recommended';
  if (score >= 65) return 'Good Match';
  return 'Needs Improvement';
};

const skillMatches = (candidateSkills, targetSkills) => {
  const candidate = normalizeList(candidateSkills);
  const target = normalizeList(targetSkills);
  const candidateNormalized = candidate.map((skill) => ({ skill, key: normalizeText(skill) }));
  const matchedSkills = [];
  const missingSkills = [];

  target.forEach((skill) => {
    const key = normalizeText(skill);
    const match = candidateNormalized.find((candidateSkill) => (
      candidateSkill.key === key
      || candidateSkill.key.includes(key)
      || key.includes(candidateSkill.key)
    ));

    if (match) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  return { matchedSkills, missingSkills, targetSkills: target, candidateSkills: candidate };
};

const calculateExperienceScore = (candidateYears, targetLevel, expectedExperience = {}) => {
  const years = Math.max(toNumber(candidateYears), 0);
  const expected = {
    ...LEVEL_EXPERIENCE[targetLevel],
    ...expectedExperience
  };

  const minYears = Math.max(toNumber(expected.min, LEVEL_EXPERIENCE[targetLevel].min), 0);
  const idealYears = Math.max(toNumber(expected.ideal, LEVEL_EXPERIENCE[targetLevel].ideal), minYears || 1);

  if (years >= idealYears) return 1;
  if (idealYears <= 0) return 1;

  return clamp(years / idealYears);
};

const calculateLevelFitScore = (candidateLevel, targetLevel) => {
  const candidateIndex = LEVEL_ORDER.indexOf(candidateLevel);
  const targetIndex = LEVEL_ORDER.indexOf(targetLevel);

  if (candidateIndex < 0 || targetIndex < 0) return 0.5;

  const distance = Math.abs(candidateIndex - targetIndex);
  if (distance === 0) return 1;
  if (distance === 1) return 0.75;
  if (distance === 2) return 0.45;
  return 0.2;
};

const calculateFormulaScore = ({ candidateProfile, targetProfile }) => {
  const candidateSkills = normalizeList(candidateProfile.skills);
  const requiredSkills = normalizeList(targetProfile.required_skills);
  const preferredSkills = normalizeList(targetProfile.preferred_skills);
  const weightedTargetSkills = [
    ...requiredSkills,
    ...preferredSkills.filter((skill) => !requiredSkills.some((required) => normalizeText(required) === normalizeText(skill)))
  ];
  const targetSkills = weightedTargetSkills.length ? weightedTargetSkills : candidateSkills;
  const { matchedSkills, missingSkills } = skillMatches(candidateSkills, targetSkills);
  const skillScore = targetSkills.length ? matchedSkills.length / targetSkills.length : 0;

  const candidateYears = toNumber(candidateProfile.years_of_experience);
  const candidateLevel = normalizeLevel(candidateProfile.level, '', candidateYears);
  const targetLevel = normalizeLevel(targetProfile.level, targetProfile.title, 0);
  const experienceScore = calculateExperienceScore(
    candidateYears,
    targetLevel,
    targetProfile.expected_experience
  );
  const levelFitScore = calculateLevelFitScore(candidateLevel, targetLevel);
  const finalScore = Math.round((
    SCORE_WEIGHTS.skills * skillScore
    + SCORE_WEIGHTS.experience * experienceScore
    + SCORE_WEIGHTS.levelFit * levelFitScore
  ) * 100);

  return {
    finalScore,
    tier: getTier(finalScore),
    weights: SCORE_WEIGHTS,
    componentScores: {
      skills: Number(skillScore.toFixed(2)),
      experience: Number(experienceScore.toFixed(2)),
      levelFit: Number(levelFitScore.toFixed(2))
    },
    matchedSkills,
    missingSkills,
    candidateLevel,
    targetLevel,
    candidateYears
  };
};

const extractJsonObject = (text) => {
  const raw = String(text || '').trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');

  if (first < 0 || last < first) {
    throw new Error('AI không trả về JSON hợp lệ.');
  }

  return JSON.parse(raw.slice(first, last + 1));
};

const buildFeaturePrompt = ({ cvText, targetPosition }) => `
Bạn là hệ thống trích xuất dữ liệu ATS cho VietWorks.
Nhiệm vụ của bạn KHÔNG phải chấm điểm. Chỉ trích xuất feature từ CV và suy ra profile chuẩn cho vị trí mục tiêu.

Quy tắc:
- Trả về JSON hợp lệ, không markdown, không giải thích ngoài JSON.
- Mọi mảng string dùng tiếng Việt hoặc tên kỹ thuật phổ biến đúng nguyên văn.
- Không tự tạo thành tích hoặc kinh nghiệm không có trong CV.
- Nếu CV không rõ số năm kinh nghiệm, ước lượng thận trọng từ timeline; nếu vẫn không rõ trả 0.
- Không dùng lương.
- Ngày hiện tại là ${new Date().toISOString().slice(0, 10)}. Không đánh dấu các mốc ngày đã qua là "tương lai".
- Không coi năm tốt nghiệp hiện tại hoặc dự kiến tốt nghiệp trong năm hiện tại là red flag.
- Chỉ cảnh báo mốc thời gian tương lai nếu ngày kết thúc thực sự sau ngày hiện tại và không phải mốc học tập/dự kiến tốt nghiệp hợp lý.
- target_profile được suy ra từ target_position theo chuẩn thị trường, vì người dùng chỉ nhập tên vị trí.

JSON schema:
{
  "candidate_profile": {
    "skills": ["kỹ năng/kỹ thuật có bằng chứng trong CV"],
    "years_of_experience": 0,
    "level": "intern|junior|middle|senior|lead|manager",
    "red_flags": ["điểm đáng nghi hoặc thiếu rõ ràng, tiếng Việt"],
    "metric_achievements": ["thành tích có số liệu rõ ràng"],
    "vague_statements": ["mệnh đề chung chung thiếu bằng chứng"]
  },
  "target_profile": {
    "title": "${targetPosition}",
    "required_skills": ["kỹ năng cốt lõi cần có"],
    "preferred_skills": ["kỹ năng điểm cộng"],
    "level": "intern|junior|middle|senior|lead|manager",
    "expected_experience": { "min": 0, "ideal": 0, "max": 0 }
  },
  "interview_questions": [
    {
      "category": "Kỹ năng chuyên môn",
      "question": "câu hỏi thực tế dựa trên project/kỹ năng trong CV",
      "expected_answer_keywords": ["2-3 từ khóa"],
      "red_flag_if_candidate_says": "dấu hiệu thiếu trải nghiệm thực tế"
    }
  ]
}

Vị trí mục tiêu: ${targetPosition}

CV TEXT:
${String(cvText || '').slice(0, 24000)}
`;

const askGeminiForFeatures = async ({ cvText, targetPosition }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CV_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    const error = new Error('Thiếu GEMINI_API_KEY trong file .env của backend.');
    error.statusCode = 503;
    throw error;
  }

  const response = await axios.post(
    `${GEMINI_API_URL}/${model}:generateContent`,
    {
      contents: [{
        role: 'user',
        parts: [{ text: buildFeaturePrompt({ cvText, targetPosition }) }]
      }],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json',
        maxOutputTokens: 4000
      }
    },
    {
      params: { key: apiKey },
      timeout: 45000
    }
  );

  const text = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  return {
    provider: 'Gemini',
    model,
    data: extractJsonObject(text)
  };
};

const askGroqForFeatures = async ({ cvText, targetPosition }) => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_CV_MODEL || DEFAULT_GROQ_MODEL;

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
        {
          role: 'system',
          content: 'Bạn chỉ trả về JSON hợp lệ theo schema được yêu cầu. Không markdown.'
        },
        {
          role: 'user',
          content: buildFeaturePrompt({ cvText, targetPosition })
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: 4000
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    }
  );

  const text = response.data?.choices?.[0]?.message?.content;

  return {
    provider: 'Groq',
    model,
    data: extractJsonObject(text)
  };
};

const extractFeatures = async ({ cvText, targetPosition }) => {
  try {
    return await askGeminiForFeatures({ cvText, targetPosition });
  } catch (geminiError) {
    if (!process.env.GROQ_API_KEY) {
      throw geminiError;
    }

    console.warn('Gemini CV feature extraction failed, falling back to Groq:', geminiError.response?.data || geminiError.message);
    return askGroqForFeatures({ cvText, targetPosition });
  }
};

const normalizeAiFeatures = (features, targetPosition) => {
  const candidateProfile = features?.candidate_profile || {};
  const targetProfile = features?.target_profile || {};
  const candidateYears = toNumber(candidateProfile.years_of_experience);
  const targetLevel = normalizeLevel(targetProfile.level, targetPosition, 0);

  return {
    candidateProfile: {
      skills: normalizeList(candidateProfile.skills),
      years_of_experience: candidateYears,
      level: normalizeLevel(candidateProfile.level, '', candidateYears),
      red_flags: filterRedFlags(candidateProfile.red_flags),
      metric_achievements: normalizeList(candidateProfile.metric_achievements),
      vague_statements: normalizeList(candidateProfile.vague_statements)
    },
    targetProfile: {
      title: targetProfile.title || targetPosition,
      required_skills: normalizeList(targetProfile.required_skills),
      preferred_skills: normalizeList(targetProfile.preferred_skills),
      level: targetLevel,
      expected_experience: {
        ...LEVEL_EXPERIENCE[targetLevel],
        ...(targetProfile.expected_experience || {})
      }
    },
    interviewQuestions: Array.isArray(features?.interview_questions)
      ? features.interview_questions.slice(0, 3)
      : []
  };
};

const buildReasoning = ({ formula, candidateProfile, targetProfile }) => {
  const matchedCount = formula.matchedSkills.length;
  const totalSkills = matchedCount + formula.missingSkills.length;
  const missingText = formula.missingSkills.length
    ? `Thiếu ${formula.missingSkills.slice(0, 3).join(', ')}.`
    : 'Kỹ năng chính khớp tốt.';

  return `Khớp ${matchedCount}/${totalSkills || 0} kỹ năng, ${candidateProfile.years_of_experience} năm kinh nghiệm so với mức ${LEVEL_LABELS[targetProfile.level]}. ${missingText}`;
};

const buildCompatibleResult = ({ normalized, formula }) => {
  const { candidateProfile, targetProfile, interviewQuestions } = normalized;

  return {
    candidate_overview: {
      calculated_years_of_experience: candidateProfile.years_of_experience,
      verified_level: LEVEL_LABELS[formula.candidateLevel] || candidateProfile.level,
      title_inflation_detected: candidateProfile.red_flags
        .some((flag) => /chuc danh|title|thoi phong|khong khop/i.test(normalizeText(flag))),
      red_flags: candidateProfile.red_flags
    },
    skill_matrix: {
      verified_hard_skills: candidateProfile.skills,
      missing_critical_skills: formula.missingSkills
    },
    impact_analysis: {
      metric_driven_achievements: candidateProfile.metric_achievements,
      vague_statements: candidateProfile.vague_statements
    },
    evaluation: {
      job_fit_score_100: formula.finalScore,
      reasoning: buildReasoning({ formula, candidateProfile, targetProfile })
    },
    interview_generation: interviewQuestions.map((question) => ({
      category: question.category || 'Kỹ năng chuyên môn',
      question: question.question || 'Hãy mô tả chi tiết một dự án liên quan trực tiếp tới vị trí ứng tuyển.',
      expected_answer_keywords: normalizeList(question.expected_answer_keywords).slice(0, 3),
      red_flag_if_candidate_says: question.red_flag_if_candidate_says || 'Trả lời chung chung, không nêu được vai trò, công nghệ hoặc cách xử lý cụ thể.'
    })),
    formula_scoring: {
      weights: SCORE_WEIGHTS,
      component_scores: formula.componentScores,
      matched_skills: formula.matchedSkills,
      missing_skills: formula.missingSkills,
      target_profile: targetProfile,
      candidate_profile: candidateProfile,
      final_score: formula.finalScore,
      tier: formula.tier
    }
  };
};

export const analyzeCvWithFormula = async ({ pdfBuffer, fileName = 'cv.pdf', targetPosition }) => {
  if (!pdfBuffer?.length) {
    throw new Error('Không có dữ liệu file CV để phân tích.');
  }

  const parser = new PDFParse({ data: pdfBuffer });
  let parsedPdf;
  try {
    parsedPdf = await parser.getText();
  } finally {
    await parser.destroy();
  }
  const cvText = parsedPdf.text?.trim();

  if (!cvText) {
    throw new Error('Không thể trích xuất văn bản từ PDF. Vui lòng dùng PDF text thường, không phải file scan/ảnh.');
  }

  const featureResult = await extractFeatures({ cvText, targetPosition });
  const normalized = normalizeAiFeatures(featureResult.data, targetPosition);

  if (!normalized.targetProfile.required_skills.length && !normalized.targetProfile.preferred_skills.length) {
    throw new Error('AI không trích xuất được bộ kỹ năng mục tiêu để chấm theo công thức.');
  }

  const formula = calculateFormulaScore(normalized);
  const rawResult = buildCompatibleResult({ normalized, formula });

  return {
    rawResult,
    score: formula.finalScore,
    aiProvider: featureResult.provider,
    aiModel: featureResult.model,
    extractedTextLength: cvText.length,
    fileName
  };
};
