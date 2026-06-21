import cron from 'node-cron';
import Job from '../models/jobModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import User from '../models/userModels.js';
import { JobStatus } from '../enums/jobEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';

const buildMatchingJobFilter = (profile, since) => {
  const desiredJob = profile.desiredJob || {};
  const skills = profile.skills || [];

  const filter = {
    status: JobStatus.PUBLISHED,
    deadline: { $gte: new Date() },
    publishedAt: { $gte: since }
  };

  const orConditions = [];
  if (desiredJob.careerGroupId) orConditions.push({ careerGroupId: desiredJob.careerGroupId });
  if (desiredJob.careerId) orConditions.push({ careerId: desiredJob.careerId });
  if (desiredJob.careerPositionId) orConditions.push({ careerPositionId: desiredJob.careerPositionId });
  if (desiredJob.experienceLevelId) orConditions.push({ experienceLevelId: desiredJob.experienceLevelId });
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
    matchedJobs: 0
  };

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

cron.schedule('0 8 * * *', async () => {
  try {
    console.log('[CRON] Bắt đầu quét việc làm phù hợp cho ứng viên...');
    const result = await runMatchingJobScan();
    console.log('[CRON] Hoàn thành quét việc làm phù hợp:', result);
  } catch (error) {
    console.error('[CRON] Lỗi quét việc làm phù hợp:', error);
  }
});
