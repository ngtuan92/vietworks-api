import mongoose from 'mongoose';
import { JobStatus } from '../enums/jobEnums.js';

const toIdString = (value) => String(value?._id || value || '');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const getProfileSkills = (profile) => (profile?.skills || []).filter(Boolean);

const getDesiredProvinceNames = (profile) => (profile?.desiredJob?.workLocations || [])
  .map((location) => location?.provinceName)
  .filter(Boolean);

const getDesiredProvinceCodes = (profile) => (profile?.desiredJob?.workLocations || [])
  .map((location) => location?.provinceCode)
  .filter(Boolean);

export const buildPublicMatchedJobFilter = (profile, { since } = {}) => {
  const desiredJob = profile?.desiredJob || {};
  const skills = getProfileSkills(profile);
  const desiredProvinceNames = getDesiredProvinceNames(profile);
  const desiredProvinceCodes = getDesiredProvinceCodes(profile);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const andConditions = [
    { status: JobStatus.PUBLISHED },
    { deadline: { $gte: startOfToday } },
    { $or: [{ bannedReason: null }, { bannedReason: { $exists: false } }] }
  ];

  if (since) {
    andConditions.push({ publishedAt: { $gte: since } });
  }

  const matchConditions = [];
  if (desiredJob.careerGroupId) matchConditions.push({ careerGroupId: desiredJob.careerGroupId });
  if (desiredJob.careerId) matchConditions.push({ careerId: desiredJob.careerId });
  if (desiredJob.careerPositionId) matchConditions.push({ careerPositionId: desiredJob.careerPositionId });
  if (desiredJob.jobLevelId) matchConditions.push({ jobLevelId: desiredJob.jobLevelId });
  if (desiredJob.experience) matchConditions.push({ experience: desiredJob.experience });
  if (skills.length) matchConditions.push({ skills: { $in: skills } });
  if (desiredProvinceNames.length) matchConditions.push({ 'workLocations.provinceName': { $in: desiredProvinceNames } });
  if (desiredProvinceCodes.length) matchConditions.push({ 'workLocations.provinceCode': { $in: desiredProvinceCodes } });

  if (!matchConditions.length) {
    return null;
  }

  andConditions.push({ $or: matchConditions });
  return { $and: andConditions };
};

export const scoreMatchedJob = (job, profile) => {
  const desiredJob = profile?.desiredJob || {};
  const desiredSkills = getProfileSkills(profile).map(toIdString).filter(Boolean);
  const jobSkills = (job?.skills || []).map(toIdString).filter(Boolean);
  const desiredProvinceNames = getDesiredProvinceNames(profile);
  const desiredProvinceCodes = getDesiredProvinceCodes(profile);
  const jobLocations = job?.workLocations || [];

  let score = 0;

  if (desiredJob.careerPositionId && toIdString(job.careerPositionId) === toIdString(desiredJob.careerPositionId)) score += 6;
  if (desiredJob.careerId && toIdString(job.careerId) === toIdString(desiredJob.careerId)) score += 5;
  if (desiredJob.careerGroupId && toIdString(job.careerGroupId) === toIdString(desiredJob.careerGroupId)) score += 4;
  if (desiredJob.jobLevelId && toIdString(job.jobLevelId) === toIdString(desiredJob.jobLevelId)) score += 3;
  if (desiredJob.experience && job.experience === desiredJob.experience) score += 3;

  const matchedSkillCount = desiredSkills.filter((skillId) => jobSkills.includes(skillId)).length;
  score += matchedSkillCount * 2;

  const matchesLocation = jobLocations.some((location) => (
    desiredProvinceNames.includes(location?.provinceName) || desiredProvinceCodes.includes(location?.provinceCode)
  ));
  if (matchesLocation) score += 3;

  const salaryMin = desiredJob.salaryExpectationMillion?.min;
  const salaryMax = desiredJob.salaryExpectationMillion?.max;
  if ((hasValue(salaryMin) || hasValue(salaryMax)) && job?.salary?.type !== 'NEGOTIABLE') {
    const okMin = !hasValue(salaryMin) || (job.salary?.maxMillion ?? 0) >= Number(salaryMin);
    const okMax = !hasValue(salaryMax) || (job.salary?.minMillion ?? Infinity) <= Number(salaryMax);
    if (okMin && okMax) score += 2;
  }

  if (job?.premium?.isActive) score += 2;
  if (job?.isUrgent) score += 1;

  return score;
};

export const sortMatchedJobs = (jobs, profile) => [...jobs].sort((a, b) => {
  const scoreDiff = scoreMatchedJob(b, profile) - scoreMatchedJob(a, profile);
  if (scoreDiff !== 0) return scoreDiff;

  const premiumDiff = Number(Boolean(b?.premium?.isActive)) - Number(Boolean(a?.premium?.isActive));
  if (premiumDiff !== 0) return premiumDiff;

  return new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0);
});

export const toObjectId = (value) => (
  value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null
);
