import 'dotenv/config';
import mongoose from 'mongoose';

const EMPLOYER_USER_ID = '6a25c88c7c93506ebd8d0551';
const NOW = new Date();
const DEADLINE = new Date('2026-12-31T23:59:59.000Z');

const jobSeeds = [
  {
    title: 'Frontend Developer ReactJS',
    experience: '1-2 năm',
    description: 'Phát triển giao diện web tuyển dụng hiện đại bằng ReactJS, tối ưu trải nghiệm người dùng và hiệu năng hiển thị.',
    requirements: 'Thành thạo ReactJS, JavaScript, HTML, CSS, REST API. Có tư duy component, biết Git và responsive UI.',
    benefits: 'Lương cạnh tranh, thưởng dự án, bảo hiểm đầy đủ, review lương định kỳ, môi trường công nghệ trẻ.',
    workingTime: 'Thứ 2 - Thứ 6, 08:30 - 17:30',
    headcount: 3,
    salary: { type: 'RANGE', minMillion: 15, maxMillion: 25, currency: 'VND' },
    skillKeywords: ['React', 'JavaScript', 'HTML', 'CSS']
  },
  {
    title: 'Backend Developer NodeJS',
    experience: '2 năm',
    description: 'Xây dựng API, xử lý nghiệp vụ backend, tối ưu truy vấn MongoDB và tích hợp các dịch vụ nội bộ.',
    requirements: 'Có kinh nghiệm NodeJS, ExpressJS, MongoDB, JWT, REST API. Ưu tiên biết thiết kế schema và bảo mật API.',
    benefits: 'Thu nhập hấp dẫn, lương tháng 13, phụ cấp ăn trưa, đào tạo chuyên môn và cơ hội lên Senior.',
    workingTime: 'Thứ 2 - Thứ 6, 08:30 - 17:30',
    headcount: 2,
    salary: { type: 'RANGE', minMillion: 18, maxMillion: 30, currency: 'VND' },
    skillKeywords: ['Node', 'Express', 'MongoDB', 'API']
  },
  {
    title: 'Fullstack Developer MERN',
    experience: '2-3 năm',
    description: 'Tham gia phát triển sản phẩm web end-to-end với ReactJS, NodeJS và MongoDB theo quy trình Agile.',
    requirements: 'Nắm vững ReactJS, NodeJS, MongoDB, REST API. Có khả năng phân tích yêu cầu và phối hợp với UI/UX.',
    benefits: 'Review lương 2 lần/năm, thưởng hiệu suất, bảo hiểm, teambuilding và lộ trình phát triển rõ ràng.',
    workingTime: 'Thứ 2 - Thứ 6, 09:00 - 18:00',
    headcount: 2,
    salary: { type: 'RANGE', minMillion: 22, maxMillion: 35, currency: 'VND' },
    skillKeywords: ['React', 'Node', 'MongoDB', 'JavaScript']
  },
  {
    title: 'QA Tester Web Application',
    experience: '1 năm',
    description: 'Kiểm thử chức năng web, viết test case, ghi nhận lỗi và phối hợp với developer để đảm bảo chất lượng sản phẩm.',
    requirements: 'Biết quy trình test, viết test case, hiểu API testing cơ bản. Cẩn thận, giao tiếp tốt và có tư duy người dùng.',
    benefits: 'Môi trường ổn định, đào tạo nghiệp vụ, thưởng chất lượng, bảo hiểm và các hoạt động nội bộ.',
    workingTime: 'Thứ 2 - Thứ 6, 08:30 - 17:30',
    headcount: 2,
    salary: { type: 'RANGE', minMillion: 10, maxMillion: 18, currency: 'VND' },
    skillKeywords: ['Testing', 'QA', 'API', 'Postman']
  },
  {
    title: 'UI UX Designer',
    experience: '1-2 năm',
    description: 'Thiết kế giao diện web/app, xây dựng design system và cải thiện trải nghiệm người dùng cho sản phẩm tuyển dụng.',
    requirements: 'Thành thạo Figma, tư duy UX tốt, hiểu responsive design. Có portfolio sản phẩm web/app là lợi thế.',
    benefits: 'Không gian sáng tạo, thưởng hiệu quả, được tham gia trực tiếp vào định hướng sản phẩm và nghiên cứu người dùng.',
    workingTime: 'Thứ 2 - Thứ 6, 09:00 - 18:00',
    headcount: 1,
    salary: { type: 'RANGE', minMillion: 14, maxMillion: 24, currency: 'VND' },
    skillKeywords: ['Figma', 'UI', 'UX', 'Design']
  },
  {
    title: 'Business Analyst',
    experience: '2 năm',
    description: 'Thu thập yêu cầu, phân tích nghiệp vụ, viết tài liệu đặc tả và phối hợp với đội phát triển sản phẩm.',
    requirements: 'Có kinh nghiệm phân tích nghiệp vụ, viết user story, wireframe, tài liệu SRS. Giao tiếp tốt với khách hàng và đội kỹ thuật.',
    benefits: 'Lộ trình lên Senior BA/Product Owner, thưởng dự án, bảo hiểm đầy đủ và môi trường làm việc chuyên nghiệp.',
    workingTime: 'Thứ 2 - Thứ 6, 08:30 - 17:30',
    headcount: 2,
    salary: { type: 'RANGE', minMillion: 16, maxMillion: 28, currency: 'VND' },
    skillKeywords: ['BA', 'Agile', 'Scrum', 'Wireframe']
  },
  {
    title: 'DevOps Engineer',
    experience: '2-4 năm',
    description: 'Xây dựng CI/CD, quản lý hạ tầng triển khai, giám sát hệ thống và tối ưu độ ổn định sản phẩm.',
    requirements: 'Có kinh nghiệm Docker, CI/CD, Linux, cloud cơ bản. Biết monitoring, logging và bảo mật triển khai là lợi thế.',
    benefits: 'Phụ cấp chứng chỉ, thưởng vận hành, môi trường kỹ thuật chuyên sâu và cơ hội làm việc với hệ thống thực tế.',
    workingTime: 'Thứ 2 - Thứ 6, 09:00 - 18:00',
    headcount: 1,
    salary: { type: 'RANGE', minMillion: 25, maxMillion: 40, currency: 'VND' },
    skillKeywords: ['Docker', 'Linux', 'CI/CD', 'AWS']
  },
  {
    title: 'Mobile Developer Flutter',
    experience: '1-3 năm',
    description: 'Phát triển ứng dụng mobile bằng Flutter, tích hợp API và tối ưu trải nghiệm trên Android/iOS.',
    requirements: 'Có kinh nghiệm Flutter/Dart, hiểu state management, REST API và quy trình build app mobile.',
    benefits: 'Thưởng sản phẩm, hỗ trợ thiết bị làm việc, đào tạo kỹ thuật mới và review lương định kỳ.',
    workingTime: 'Thứ 2 - Thứ 6, 08:30 - 17:30',
    headcount: 2,
    salary: { type: 'RANGE', minMillion: 18, maxMillion: 32, currency: 'VND' },
    skillKeywords: ['Flutter', 'Dart', 'Mobile', 'API']
  },
  {
    title: 'Data Analyst',
    experience: '1-2 năm',
    description: 'Phân tích dữ liệu người dùng, xây dựng báo cáo, dashboard và đề xuất cải thiện hiệu quả kinh doanh.',
    requirements: 'Biết SQL, Excel/Google Sheets, trực quan hóa dữ liệu. Ưu tiên có kinh nghiệm Power BI hoặc Python.',
    benefits: 'Được tiếp cận dữ liệu thực tế, thưởng hiệu quả, đào tạo phân tích dữ liệu và cơ hội phát triển lên Data Lead.',
    workingTime: 'Thứ 2 - Thứ 6, 09:00 - 18:00',
    headcount: 1,
    salary: { type: 'RANGE', minMillion: 14, maxMillion: 26, currency: 'VND' },
    skillKeywords: ['SQL', 'Excel', 'Power BI', 'Python']
  },
  {
    title: 'Product Manager',
    experience: '3 năm',
    description: 'Định hướng sản phẩm, quản lý backlog, phối hợp với thiết kế, kỹ thuật và kinh doanh để phát triển tính năng mới.',
    requirements: 'Có kinh nghiệm quản lý sản phẩm số, hiểu Agile/Scrum, biết phân tích dữ liệu và làm việc với nhiều bên liên quan.',
    benefits: 'Vai trò chiến lược, thưởng theo hiệu quả sản phẩm, môi trường chuyên nghiệp và cơ hội phát triển quản lý.',
    workingTime: 'Thứ 2 - Thứ 6, 09:00 - 18:00',
    headcount: 1,
    salary: { type: 'RANGE', minMillion: 30, maxMillion: 50, currency: 'VND' },
    skillKeywords: ['Product', 'Agile', 'Scrum', 'Analytics']
  }
];

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const activeFilter = { status: { $ne: 'INACTIVE' } };
const normalizeText = (value = '') => value.toString().toLowerCase();

function toJobLocationSnapshot(location) {
  if (!location) return null;

  return {
    provinceCode: location.provinceCode || null,
    provinceName: location.provinceName || location.province || null,
    districtCode: location.districtCode || null,
    districtName: location.districtName || location.district || null,
    wardCode: location.wardCode || null,
    wardName: location.wardName || location.ward || null,
    detailAddress: location.detailAddress || location.addressLine || location.addressDetail || null
  };
}

async function getRequiredContext(db) {
  const employerId = toObjectId(EMPLOYER_USER_ID);
  const employer = await db.collection('users').findOne({ _id: employerId });
  if (!employer) throw new Error(`Không tìm thấy employer ${EMPLOYER_USER_ID}`);
  if (employer.role !== 'EMPLOYER') throw new Error(`User ${EMPLOYER_USER_ID} không phải EMPLOYER`);
  if (employer.accountStatus !== 'ACTIVE') throw new Error(`Employer đang không ACTIVE: ${employer.accountStatus}`);

  const company = await db.collection('companies').findOne({ ownerUserId: employerId });
  if (!company) throw new Error('Employer này chưa có company trong collection companies');
  if (company.verificationStatus !== 'VERIFIED') {
    throw new Error(`Company chưa VERIFIED nên job public có thể không hiển thị. Trạng thái hiện tại: ${company.verificationStatus}`);
  }

  const companyLocations = await db.collection('company_locations')
    .find({ companyId: company._id, status: { $ne: 'INACTIVE' } })
    .sort({ isPrimary: -1, createdAt: 1 })
    .toArray();

  const fallbackCompanyLocations = Array.isArray(company.locations) ? company.locations : [];
  if (!companyLocations.length && !fallbackCompanyLocations.length) {
    throw new Error('Company chưa có địa điểm trong company_locations hoặc companies.locations, nên chưa thể chụp snapshot cho job');
  }

  const careerGroups = await db.collection('career_groups').find(activeFilter).sort({ order: 1, name: 1 }).toArray();
  const careers = await db.collection('careers').find(activeFilter).sort({ order: 1, name: 1 }).toArray();
  const positions = await db.collection('career_positions').find(activeFilter).sort({ order: 1, name: 1 }).toArray();
  const jobLevels = await db.collection('job_levels').find(activeFilter).sort({ levelOrder: 1, name: 1 }).toArray();
  const skills = await db.collection('skills').find(activeFilter).sort({ name: 1 }).toArray();

  if (!careerGroups.length) throw new Error('Thiếu master data career_groups ACTIVE');
  if (!careers.length) throw new Error('Thiếu master data careers ACTIVE');
  if (!positions.length) throw new Error('Thiếu master data career_positions ACTIVE');
  if (!jobLevels.length) throw new Error('Thiếu master data job_levels ACTIVE');

  return {
    employerId,
    employer,
    company,
    companyLocations,
    fallbackCompanyLocations,
    careerGroups,
    careers,
    positions,
    jobLevels,
    skills
  };
}

function pickCareerChain(context, index) {
  const group = context.careerGroups[index % context.careerGroups.length];
  const careersInGroup = context.careers.filter((career) => String(career.careerGroupId) === String(group._id));
  const career = careersInGroup[index % Math.max(careersInGroup.length, 1)] || context.careers[index % context.careers.length];
  const positionsInCareer = context.positions.filter((position) => String(position.careerId) === String(career._id));
  const position = positionsInCareer[index % Math.max(positionsInCareer.length, 1)] || context.positions[index % context.positions.length];
  const actualGroup = context.careerGroups.find((item) => String(item._id) === String(career.careerGroupId)) || group;

  return { group: actualGroup, career, position };
}

function pickSkills(context, seed, chain) {
  if (!context.skills.length) return [];

  const matchedByKeyword = context.skills.filter((skill) => {
    const name = normalizeText(skill.name);
    const aliases = Array.isArray(skill.aliases) ? skill.aliases.map(normalizeText).join(' ') : '';
    return seed.skillKeywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      return name.includes(normalizedKeyword) || aliases.includes(normalizedKeyword);
    });
  });

  const matchedByCareerGroup = context.skills.filter((skill) => {
    if (!Array.isArray(skill.careerGroupIds)) return false;
    return skill.careerGroupIds.some((groupId) => String(groupId) === String(chain.group._id));
  });

  return [...matchedByKeyword, ...matchedByCareerGroup, ...context.skills]
    .filter((skill, index, array) => array.findIndex((item) => String(item._id) === String(skill._id)) === index)
    .slice(0, 4);
}

function buildJobDocument(context, seed, index) {
  const chain = pickCareerChain(context, index);
  const level = context.jobLevels[index % context.jobLevels.length];
  const selectedSkills = pickSkills(context, seed, chain);
  const sourceLocations = context.companyLocations.length ? context.companyLocations : context.fallbackCompanyLocations;
  const companyLocation = toJobLocationSnapshot(sourceLocations[index % sourceLocations.length]);

  return {
    companyId: context.company._id,
    createdBy: context.employerId,
    title: seed.title,
    careerGroupId: chain.group._id,
    careerGroupNameSnapshot: chain.group.name,
    careerId: chain.career._id,
    careerNameSnapshot: chain.career.name,
    careerPositionId: chain.position._id,
    careerPositionNameSnapshot: chain.position.name,
    jobLevelId: level._id,
    jobLevelNameSnapshot: level.name,
    companyNameSnapshot: context.company.name,
    companyLogoSnapshot: context.company.avatarUrl || null,
    experience: seed.experience,
    skills: selectedSkills.map((skill) => skill._id),
    skillNameSnapshots: selectedSkills.map((skill) => skill.name),
    salary: seed.salary,
    workLocations: [companyLocation],
    saturdayPolicy: 'OFF_SATURDAY',
    description: seed.description,
    requirements: seed.requirements,
    benefits: seed.benefits,
    workingTime: seed.workingTime,
    applyInstruction: 'Ứng viên nộp hồ sơ trực tuyến bằng cách bấm nút Ứng tuyển trên VietWorks.',
    headcount: seed.headcount,
    deadline: DEADLINE,
    status: 'PUBLISHED',
    isUrgent: index === 1 || index === 6,
    premium: {
      isActive: false,
      startedAt: null,
      expiredAt: null,
      packagePrice: 0,
      deactivatedAt: null,
      deactivatedReason: null
    },
    publishedAt: NOW,
    closedAt: null,
    rejectedReason: null,
    bannedReason: null,
    submittedAt: NOW,
    reviewedAt: NOW,
    reviewedBy: null,
    reviewNote: 'Dữ liệu demo đã được duyệt để hiển thị public.',
    applicationCount: 0,
    createdAt: NOW,
    updatedAt: NOW
  };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong vietworks-api/.env');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const context = await getRequiredContext(db);
  const jobs = db.collection('jobs');

  const results = [];
  for (let index = 0; index < jobSeeds.length; index += 1) {
    const seed = jobSeeds[index];
    const existingJob = await jobs.findOne({ companyId: context.company._id, title: seed.title });
    if (existingJob) {
      results.push({ title: seed.title, action: 'SKIPPED_EXISTS', jobId: existingJob._id });
      continue;
    }

    const document = buildJobDocument(context, seed, index);
    const insertResult = await jobs.insertOne(document);
    results.push({ title: seed.title, action: 'INSERTED', jobId: insertResult.insertedId });
  }

  console.log(JSON.stringify({
    ok: true,
    employer: {
      _id: context.employer._id,
      email: context.employer.email,
      fullName: context.employer.fullName
    },
    company: {
      _id: context.company._id,
      name: context.company.name,
      verificationStatus: context.company.verificationStatus,
      locationSource: context.companyLocations.length ? 'company_locations' : 'companies.locations'
    },
    inserted: results.filter((item) => item.action === 'INSERTED').length,
    skipped: results.filter((item) => item.action === 'SKIPPED_EXISTS').length,
    deadline: DEADLINE,
    results
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
