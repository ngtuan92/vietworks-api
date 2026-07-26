import 'dotenv/config';
import mongoose from 'mongoose';

const EMPLOYER_USER_ID = '6a25c88c7c93506ebd8d0551';

const jobCategoryFixes = [
  {
    title: 'Frontend Developer ReactJS',
    careerKeywords: ['phát triển phần mềm', 'software', 'lập trình', 'web', 'frontend'],
    positionKeywords: ['frontend', 'front-end', 'react'],
    skillKeywords: ['react', 'javascript', 'html', 'css']
  },
  {
    title: 'Backend Developer NodeJS',
    careerKeywords: ['phát triển phần mềm', 'software', 'lập trình', 'backend'],
    positionKeywords: ['backend', 'back-end', 'node'],
    skillKeywords: ['node', 'express', 'mongodb', 'api']
  },
  {
    title: 'Fullstack Developer MERN',
    careerKeywords: ['phát triển phần mềm', 'software', 'lập trình', 'fullstack'],
    positionKeywords: ['fullstack', 'full-stack', 'developer'],
    skillKeywords: ['react', 'node', 'mongodb', 'javascript']
  },
  {
    title: 'QA Tester Web Application',
    careerKeywords: ['kiểm thử', 'testing', 'qa', 'quality', 'phần mềm'],
    positionKeywords: ['qa', 'tester', 'testing', 'kiểm thử'],
    skillKeywords: ['testing', 'qa', 'api', 'postman']
  },
  {
    title: 'UI UX Designer',
    careerKeywords: ['thiết kế', 'ui', 'ux', 'product', 'sản phẩm'],
    positionKeywords: ['ui', 'ux', 'designer', 'thiết kế'],
    skillKeywords: ['figma', 'ui', 'ux', 'design']
  },
  {
    title: 'Business Analyst',
    careerKeywords: ['business analyst', 'phân tích nghiệp vụ', 'ba', 'sản phẩm', 'product'],
    positionKeywords: ['business analyst', 'ba', 'phân tích nghiệp vụ'],
    skillKeywords: ['ba', 'agile', 'scrum', 'wireframe']
  },
  {
    title: 'DevOps Engineer',
    careerKeywords: ['devops', 'hạ tầng', 'infrastructure', 'cloud', 'vận hành'],
    positionKeywords: ['devops', 'cloud', 'infrastructure'],
    skillKeywords: ['docker', 'linux', 'ci/cd', 'aws']
  },
  {
    title: 'Mobile Developer Flutter',
    careerKeywords: ['mobile', 'ứng dụng di động', 'phát triển phần mềm', 'software'],
    positionKeywords: ['mobile', 'flutter', 'android', 'ios'],
    skillKeywords: ['flutter', 'dart', 'mobile', 'api']
  },
  {
    title: 'Data Analyst',
    careerKeywords: ['data', 'dữ liệu', 'phân tích dữ liệu', 'analytics'],
    positionKeywords: ['data analyst', 'analytics', 'dữ liệu'],
    skillKeywords: ['sql', 'excel', 'power bi', 'python']
  },
  {
    title: 'Product Manager',
    careerKeywords: ['product', 'sản phẩm', 'quản lý sản phẩm'],
    positionKeywords: ['product manager', 'product owner', 'quản lý sản phẩm'],
    skillKeywords: ['product', 'agile', 'scrum', 'analytics']
  }
];

const activeFilter = { status: { $ne: 'INACTIVE' } };
const normalize = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9+#./\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const hasAnyKeyword = (source, keywords = []) => {
  const normalizedSource = normalize(source);
  return keywords.some((keyword) => normalizedSource.includes(normalize(keyword)));
};

const textOf = (doc) => normalize([
  doc?.name,
  doc?.slug,
  doc?.code,
  doc?.description,
  ...(Array.isArray(doc?.aliases) ? doc.aliases : [])
].filter(Boolean).join(' '));

const pickBest = (items, keywords, fallbackItems = []) => {
  const match = items.find((item) => hasAnyKeyword(textOf(item), keywords));
  if (match) return match;
  return fallbackItems[0] || items[0] || null;
};

const findTechnologyGroup = (careerGroups) => {
  const keywords = [
    'cong nghe thong tin',
    'cong-nghe-thong-tin',
    'cntt',
    'information technology',
    'it',
    'software',
    'lap trinh'
  ];

  return careerGroups.find((group) => hasAnyKeyword(textOf(group), keywords)) || null;
};

const pickCareerChain = ({ careerGroups, careers, positions }, fix) => {
  const technologyGroup = findTechnologyGroup(careerGroups);
  if (!technologyGroup) {
    throw new Error('Không tìm thấy nhóm ngành Công nghệ thông tin trong career_groups');
  }

  const careersInTech = careers.filter((career) => String(career.careerGroupId) === String(technologyGroup._id));
  if (!careersInTech.length) {
    throw new Error(`Nhóm ngành ${technologyGroup.name} chưa có career ACTIVE`);
  }

  const career = pickBest(careersInTech, fix.careerKeywords, careersInTech);
  if (!career) throw new Error(`Không tìm thấy career phù hợp cho job ${fix.title}`);

  const positionsInCareer = positions.filter((position) => String(position.careerId) === String(career._id));
  const positionsInTech = positions.filter((position) => String(position.careerGroupId) === String(technologyGroup._id));
  const position = pickBest(positionsInCareer, fix.positionKeywords, positionsInTech);
  if (!position) throw new Error(`Không tìm thấy career_position phù hợp cho job ${fix.title}`);

  return { group: technologyGroup, career, position };
};

const pickSkills = (skills, fix, group) => {
  const matchedByKeyword = skills.filter((skill) => hasAnyKeyword(textOf(skill), fix.skillKeywords));
  const matchedByGroup = skills.filter((skill) => Array.isArray(skill.careerGroupIds)
    && skill.careerGroupIds.some((groupId) => String(groupId) === String(group._id)));

  return [...matchedByKeyword, ...matchedByGroup, ...skills]
    .filter((skill, index, array) => array.findIndex((item) => String(item._id) === String(skill._id)) === index)
    .slice(0, 4);
};

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong vietworks-api/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const employerId = new mongoose.Types.ObjectId(EMPLOYER_USER_ID);
  const company = await db.collection('companies').findOne({ ownerUserId: employerId });
  if (!company) throw new Error('Không tìm thấy company của employer này');

  const [careerGroups, careers, positions, skills] = await Promise.all([
    db.collection('career_groups').find(activeFilter).sort({ order: 1, name: 1 }).toArray(),
    db.collection('careers').find(activeFilter).sort({ order: 1, name: 1 }).toArray(),
    db.collection('career_positions').find(activeFilter).sort({ order: 1, name: 1 }).toArray(),
    db.collection('skills').find(activeFilter).sort({ name: 1 }).toArray()
  ]);

  if (!careerGroups.length) throw new Error('Thiếu career_groups ACTIVE');
  if (!careers.length) throw new Error('Thiếu careers ACTIVE');
  if (!positions.length) throw new Error('Thiếu career_positions ACTIVE');

  const jobs = db.collection('jobs');
  const results = [];

  for (const fix of jobCategoryFixes) {
    const job = await jobs.findOne({ companyId: company._id, createdBy: employerId, title: fix.title });
    if (!job) {
      results.push({ title: fix.title, action: 'SKIPPED_NOT_FOUND' });
      continue;
    }

    const chain = pickCareerChain({ careerGroups, careers, positions }, fix);
    const selectedSkills = pickSkills(skills, fix, chain.group);

    const update = {
      $set: {
        careerGroupId: chain.group._id,
        careerGroupNameSnapshot: chain.group.name,
        careerId: chain.career._id,
        careerNameSnapshot: chain.career.name,
        careerPositionId: chain.position._id,
        careerPositionNameSnapshot: chain.position.name,
        skills: selectedSkills.map((skill) => skill._id),
        skillNameSnapshots: selectedSkills.map((skill) => skill.name),
        updatedAt: new Date()
      }
    };

    await jobs.updateOne({ _id: job._id }, update);
    results.push({
      title: fix.title,
      action: 'UPDATED_IN_PLACE',
      jobId: job._id,
      careerGroupNameSnapshot: chain.group.name,
      careerNameSnapshot: chain.career.name,
      careerPositionNameSnapshot: chain.position.name,
      skillNameSnapshots: selectedSkills.map((skill) => skill.name)
    });
  }

  console.log(JSON.stringify({
    ok: true,
    message: 'Đã sửa phân loại 10 job demo theo hướng update in-place, không xóa job và không đổi _id.',
    company: {
      _id: company._id,
      name: company.name
    },
    updated: results.filter((item) => item.action === 'UPDATED_IN_PLACE').length,
    skipped: results.filter((item) => item.action !== 'UPDATED_IN_PLACE').length,
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
