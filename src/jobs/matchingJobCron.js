import cron from 'node-cron';
import Job from '../models/jobModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import User from '../models/userModels.js';
import { Notification } from '../models/index.js';
import { JobStatus } from '../enums/jobEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';

// Giờ VN — để cron 08:00 chạy đúng 8h sáng Việt Nam bất kể timezone của server.
const TZ = 'Asia/Ho_Chi_Minh';

const buildMatchingJobFilter = (profile, since) => {
  const desiredJob = profile.desiredJob || {};
  const skills = profile.skills || [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const filter = {
    status: JobStatus.PUBLISHED,
    deadline: { $gte: startOfToday },
    publishedAt: { $gte: since }
  };

  const orConditions = [];
  if (desiredJob.careerGroupId) orConditions.push({ careerGroupId: desiredJob.careerGroupId });
  if (desiredJob.careerId) orConditions.push({ careerId: desiredJob.careerId });
  if (desiredJob.careerPositionId) orConditions.push({ careerPositionId: desiredJob.careerPositionId });
  if (desiredJob.experience) orConditions.push({ experience: desiredJob.experience });
  if (skills.length) orConditions.push({ skills: { $in: skills } });

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  const salaryMin = desiredJob.salaryExpectationMillion?.min;
  const salaryMax = desiredJob.salaryExpectationMillion?.max;
  if (salaryMin || salaryMax) {
    filter['salary.type'] = { $ne: 'NEGOTIABLE' };
    if (salaryMin) filter['salary.maxMillion'] = { $gte: salaryMin };
    if (salaryMax) filter['salary.minMillion'] = { $lte: salaryMax };
  }

  return filter;
};

const formatJobsForNotification = (jobs) => jobs.map((job) => ({
  jobId: job._id,
  title: job.title,
  companyName: job.companyId?.name,
  logo: job.companyId?.avatarUrl,
  salary: job.salary?.minMillion && job.salary?.maxMillion
    ? `${job.salary.minMillion} - ${job.salary.maxMillion} triệu`
    : 'Thỏa thuận',
  location: job.workLocations?.[0]?.provinceName || 'Cả nước',
  jobUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/jobs/${job._id}`
}));

export const runMatchingJobScan = async ({ since } = {}) => {
  const scanSince = since || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = {
    scannedProfiles: 0,
    notifiedUsers: 0,
    matchedJobs: 0,
    skippedAlreadyNotified: 0
  };

  // Mốc đầu ngày (theo giờ server) — dùng để chống trùng: mỗi user tối đa
  // 1 thông báo MATCHING_JOB / ngày, kể cả khi cron chạy lại hoặc restart giữa ngày.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const profiles = await JobseekerProfile.find({
    $or: [
      { 'desiredJob.careerGroupId': { $exists: true } },
      { 'desiredJob.careerId': { $exists: true } },
      { 'desiredJob.careerPositionId': { $exists: true } },
      { skills: { $exists: true, $not: { $size: 0 } } }
    ]
  }).select('userId desiredJob skills notificationSettings').lean();

  result.scannedProfiles = profiles.length;

  for (const profile of profiles) {
    const user = await User.findById(profile.userId).select('notificationSettings email fullName').lean();
    if (!user || user.notificationSettings?.jobRecommendations === false) {
      continue;
    }

    // Chống trùng: đã có thông báo việc-làm-phù-hợp trong ngày hôm nay thì bỏ qua.
    const alreadyNotified = await Notification.exists({
      receiverUserId: profile.userId,
      typeCode: NotificationTypeCode.MATCHING_JOB,
      createdAt: { $gte: startOfToday }
    });
    if (alreadyNotified) {
      result.skippedAlreadyNotified += 1;
      continue;
    }

    const jobs = await Job.find(buildMatchingJobFilter(profile, scanSince))
      .populate('companyId', 'name avatarUrl')
      .select('title salary workLocations companyId')
      .limit(10)
      .lean();

    if (!jobs.length) {
      continue;
    }

    await NotificationService.create({
      receiverUserId: profile.userId,
      typeCode: NotificationTypeCode.MATCHING_JOB,
      title: `Có ${jobs.length} việc làm mới phù hợp với bạn hôm nay`,
      content: `Hệ thống vừa tìm thấy ${jobs.length} việc làm mới phù hợp với nhu cầu của bạn. Khám phá ngay!`,
      metadata: { jobs: formatJobsForNotification(jobs) }
    });

    result.notifiedUsers += 1;
    result.matchedJobs += jobs.length;
  }

  return result;
};

// 08:00 (giờ VN) mỗi ngày — quét việc làm phù hợp, gửi thông báo IN-APP + EMAIL.
// NotificationService.create() mặc định gửi cả 2 kênh; dedup ở trên bảo đảm 1 lần/ngày.
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('=== [CRON 08:00] Bắt đầu quét việc làm phù hợp cho ứng viên... ===');
    const result = await runMatchingJobScan();
    console.log('=== [CRON 08:00] Hoàn thành quét việc làm phù hợp:', JSON.stringify(result), '===');
  } catch (error) {
    console.error('=== [CRON 08:00] Lỗi quét việc làm phù hợp:', error);
  }
}, { timezone: TZ });
