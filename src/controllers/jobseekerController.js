import mongoose from 'mongoose';
import Job from '../models/jobModels.js';
import SavedJob from '../models/savedJobModels.js';
import FollowedCompany from '../models/followedCompanyModels.js';
import Company from '../models/companyModels.js';
import CompanyLocation from '../models/companyLocationModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import { JobStatus } from '../enums/jobEnums.js';
import { CommonStatus, CompanyVerificationStatus } from '../enums/masterDataEnums.js';

const MAX_SEARCH_HISTORY = 20;

const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;

const publicJobFilter = () => ({
  status: JobStatus.PUBLISHED,
  deadline: { $gte: new Date() },
  $or: [{ bannedReason: null }, { bannedReason: { $exists: false } }]
});

// ─────────────────────────────────────────────
// SEARCH HISTORY
// ─────────────────────────────────────────────

export const getSearchHistory = async (req, res) => {
  try {
    const profile = await JobseekerProfile.findOne({ userId: req.user._id })
      .select('searchHistory')
      .lean();

    const history = (profile?.searchHistory || [])
      .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt));

    return res.status(200).json({ success: true, data: history });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const addSearchHistory = async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: 'keyword không được để trống' });
    }

    const kw = keyword.trim();

    const profile = await JobseekerProfile.findOne({ userId: req.user._id }).select('searchHistory');
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng viên' });
    }

    // Xóa entry trùng keyword (case-insensitive) nếu có để tránh trùng
    profile.searchHistory = profile.searchHistory.filter(
      (h) => h.keyword.toLowerCase() !== kw.toLowerCase()
    );

    // Thêm mới lên đầu
    profile.searchHistory.unshift({ keyword: kw, searchedAt: new Date() });

    // Giữ tối đa MAX_SEARCH_HISTORY mục gần nhất
    if (profile.searchHistory.length > MAX_SEARCH_HISTORY) {
      profile.searchHistory = profile.searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Đã lưu lịch sử tìm kiếm',
      data: profile.searchHistory
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const clearSearchHistory = async (req, res) => {
  try {
    await JobseekerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { searchHistory: [] }
    );
    return res.status(200).json({ success: true, message: 'Đã xóa toàn bộ lịch sử tìm kiếm' });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────
// JOB PREFERENCES & MATCHED JOBS
// ─────────────────────────────────────────────

export const updateJobPreferences = async (req, res) => {
  try {
    const {
      careerGroupId,
      careerId,
      careerPositionId,
      experienceLevelId,
      salaryMin,
      salaryMax,
      workLocations,
      skills
    } = req.body;

    const update = { desiredJob: {} };

    if (careerGroupId !== undefined) update.desiredJob.careerGroupId = toObjectId(careerGroupId);
    if (careerId !== undefined) update.desiredJob.careerId = toObjectId(careerId);
    if (careerPositionId !== undefined) update.desiredJob.careerPositionId = toObjectId(careerPositionId);
    if (experienceLevelId !== undefined) update.desiredJob.experienceLevelId = toObjectId(experienceLevelId);
    if (salaryMin !== undefined || salaryMax !== undefined) {
      update.desiredJob.salaryExpectationMillion = {
        min: salaryMin !== undefined ? Number(salaryMin) : null,
        max: salaryMax !== undefined ? Number(salaryMax) : null
      };
    }
    if (workLocations !== undefined) update.desiredJob.workLocations = workLocations;
    if (skills !== undefined) {
      update.skills = skills
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }

    const profile = await JobseekerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: update },
      { new: true, upsert: true }
    )
      .populate('desiredJob.careerGroupId', 'name')
      .populate('desiredJob.careerId', 'name')
      .populate('desiredJob.careerPositionId', 'name')
      .populate('desiredJob.experienceLevelId', 'name')
      .populate('skills', 'name');

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật nhu cầu việc làm',
      data: {
        desiredJob: profile.desiredJob,
        skills: profile.skills
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

export const getMatchedJobs = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const profile = await JobseekerProfile.findOne({ userId: req.user._id })
      .select('desiredJob skills')
      .lean();

    if (!profile?.desiredJob) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
        message: 'Bạn chưa cài đặt nhu cầu việc làm'
      });
    }

    const { desiredJob, skills } = profile;
    const filter = { ...publicJobFilter() };
    const orConditions = [];

    if (desiredJob.careerGroupId) orConditions.push({ careerGroupId: desiredJob.careerGroupId });
    if (desiredJob.careerId) orConditions.push({ careerId: desiredJob.careerId });
    if (desiredJob.careerPositionId) orConditions.push({ careerPositionId: desiredJob.careerPositionId });
    if (desiredJob.experienceLevelId) orConditions.push({ experienceLevelId: desiredJob.experienceLevelId });
    if (skills?.length) orConditions.push({ skills: { $in: skills } });

    if (!orConditions.length) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
        message: 'Bạn chưa cài đặt nhu cầu việc làm đủ để gợi ý'
      });
    }

    filter.$or = orConditions;

    // Lọc thêm theo lương nếu ứng viên có khai báo
    const salaryMin = desiredJob.salaryExpectationMillion?.min;
    const salaryMax = desiredJob.salaryExpectationMillion?.max;
    if (salaryMin || salaryMax) {
      filter['salary.type'] = { $ne: 'NEGOTIABLE' };
      if (salaryMin) filter['salary.maxMillion'] = { $gte: salaryMin };
      if (salaryMax) filter['salary.minMillion'] = { $lte: salaryMax };
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('companyId', 'name avatarUrl coverUrl')
        .populate('careerGroupId', 'name')
        .populate('careerId', 'name')
        .populate('careerPositionId', 'name')
        .populate('jobLevelId', 'name')
        .populate('experienceLevelId', 'name')
        .populate('skills', 'name')
        .sort({ 'premium.isActive': -1, isUrgent: -1, publishedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// ─────────────────────────────────────────────
// SAVED JOBS
// ─────────────────────────────────────────────

export const saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: 'jobId không hợp lệ' });
    }

    const job = await Job.findOne({ _id: jobId, ...publicJobFilter() }).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm' });
    }

    await SavedJob.create({ userId: req.user._id, jobId });
    return res.status(201).json({ success: true, message: 'Đã lưu việc làm' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bạn đã lưu việc làm này rồi' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const unsaveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await SavedJob.findOneAndDelete({ userId: req.user._id, jobId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm đã lưu' });
    }
    return res.status(200).json({ success: true, message: 'Đã bỏ lưu việc làm' });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getSavedJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const [saved, total] = await Promise.all([
      SavedJob.find({ userId: req.user._id })
        .populate({
          path: 'jobId',
          select: 'title salary workLocations deadline status companyId careerGroupId careerId isUrgent premium',
          populate: { path: 'companyId', select: 'name avatarUrl verificationStatus' }
        })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      SavedJob.countDocuments({ userId: req.user._id })
    ]);

    const data = saved.map((s) => {
      const job = s.jobId;
      return {
        savedId: s._id,
        savedAt: s.createdAt,
        job: job ? {
          id: job._id,
          title: job.title,
          salary: job.salary,
          workLocations: job.workLocations,
          deadline: job.deadline,
          status: job.status,
          isUrgent: job.isUrgent,
          isFeatured: job.premium?.isActive || false,
          company: job.companyId
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getSimilarSavedJobs = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const limitNum = Math.min(Number(limit) || 6, 20);

    // Lấy careerGroupId và careerId từ các job đã lưu
    const saved = await SavedJob.find({ userId: req.user._id })
      .populate('jobId', 'careerGroupId careerId')
      .lean();

    const careerGroupIds = [...new Set(saved.map((s) => s.jobId?.careerGroupId?.toString()).filter(Boolean))];
    const careerIds = [...new Set(saved.map((s) => s.jobId?.careerId?.toString()).filter(Boolean))];
    const savedJobIds = saved.map((s) => s.jobId?._id).filter(Boolean);

    if (!careerGroupIds.length && !careerIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const jobs = await Job.find({
      ...publicJobFilter(),
      _id: { $nin: savedJobIds },
      $or: [
        { careerGroupId: { $in: careerGroupIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { careerId: { $in: careerIds.map((id) => new mongoose.Types.ObjectId(id)) } }
      ]
    })
      .populate('companyId', 'name avatarUrl')
      .select('title salary workLocations deadline isUrgent premium companyId careerId careerGroupId')
      .sort({ 'premium.isActive': -1, publishedAt: -1 })
      .limit(limitNum)
      .lean();

    return res.status(200).json({ success: true, data: jobs });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────
// COMPANY FOLLOW
// ─────────────────────────────────────────────

export const followCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: 'companyId không hợp lệ' });
    }

    const company = await Company.findOne({
      _id: companyId,
      verificationStatus: CompanyVerificationStatus.VERIFIED
    }).lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công ty' });
    }

    await FollowedCompany.create({ userId: req.user._id, companyId });
    await Company.findByIdAndUpdate(companyId, { $inc: { followersCount: 1 } });

    return res.status(201).json({ success: true, message: 'Đã theo dõi công ty' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bạn đã theo dõi công ty này rồi' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const unfollowCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const result = await FollowedCompany.findOneAndDelete({ userId: req.user._id, companyId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Bạn chưa theo dõi công ty này' });
    }
    await Company.findByIdAndUpdate(companyId, { $inc: { followersCount: -1 } });
    return res.status(200).json({ success: true, message: 'Đã bỏ theo dõi công ty' });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getFollowedCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const [followed, total] = await Promise.all([
      FollowedCompany.find({ userId: req.user._id })
        .populate('companyId', 'name avatarUrl coverUrl followersCount verificationStatus industryId sizeId')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      FollowedCompany.countDocuments({ userId: req.user._id })
    ]);

    const data = followed.map((f) => ({
      followedAt: f.createdAt,
      company: f.companyId
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────
// PUBLIC COMPANY LIST & DETAIL
// ─────────────────────────────────────────────

export const getPublicCompanies = async (req, res) => {
  try {
    const { keyword = '', page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const filter = { verificationStatus: CompanyVerificationStatus.VERIFIED };
    if (keyword.trim()) {
      filter.name = { $regex: keyword.trim(), $options: 'i' };
    }

    const [companies, total] = await Promise.all([
      Company.aggregate([
        { $match: filter },
        { $sort: { followersCount: -1, createdAt: -1 } },
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $lookup: {
            from: 'jobs',
            let: { cid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$companyId', '$$cid'] },
                  status: 'PUBLISHED',
                  deadline: { $gte: new Date() }
                }
              },
              { $count: 'count' }
            ],
            as: 'openJobsArr'
          }
        },
        {
          $addFields: {
            openJobsCount: { $ifNull: [{ $arrayElemAt: ['$openJobsArr.count', 0] }, 0] }
          }
        },
        { $project: { openJobsArr: 0 } },
        {
          $lookup: {
            from: 'company_industries',
            localField: 'industryId',
            foreignField: '_id',
            as: 'industryId'
          }
        },
        {
          $unwind: { path: '$industryId', preserveNullAndEmptyArrays: true }
        },
        {
          $lookup: {
            from: 'company_sizes',
            localField: 'sizeId',
            foreignField: '_id',
            as: 'sizeId'
          }
        },
        {
          $unwind: { path: '$sizeId', preserveNullAndEmptyArrays: true }
        }
      ]),
      Company.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: companies,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getPublicCompanyDetail = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: 'companyId không hợp lệ' });
    }

    const company = await Company.findOne({
      _id: companyId,
      verificationStatus: CompanyVerificationStatus.VERIFIED
    })
      .populate('industryId', 'name slug')
      .populate('sizeId', 'name code minEmployees maxEmployees')
      .lean();

    if (!company) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công ty' });
    }

    const locations = await CompanyLocation.find({
      companyId,
      status: CommonStatus.ACTIVE
    })
      .select('name addressLine province district ward latitude longitude isPrimary')
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { ...company, locations }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getCompanyOpenJobs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { keyword = '', location = '', page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: 'companyId không hợp lệ' });
    }

    const filter = {
      ...publicJobFilter(),
      companyId: new mongoose.Types.ObjectId(companyId)
    };

    if (keyword.trim()) {
      filter.title = { $regex: keyword.trim(), $options: 'i' };
    }

    if (location.trim()) {
      filter.$or = [
        { 'workLocations.provinceName': { $regex: location.trim(), $options: 'i' } },
        { 'workLocations.districtName': { $regex: location.trim(), $options: 'i' } }
      ];
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select('title salary workLocations deadline isUrgent premium careerGroupId careerId jobLevelId experienceLevelId')
        .populate('careerGroupId', 'name')
        .populate('careerId', 'name')
        .populate('jobLevelId', 'name')
        .populate('experienceLevelId', 'name')
        .sort({ 'premium.isActive': -1, isUrgent: -1, publishedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
