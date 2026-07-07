import Job from '../models/jobModels.js';
import EmployerProfile from '../models/employerProfileModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import Company from '../models/companyModels.js';
import { JobStatus } from '../enums/jobEnums.js';
import mongoose from 'mongoose';
import Skill from '../models/skillModels.js';
import Career from '../models/careerModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import JobLevel from '../models/jobLevelModels.js';
import ExperienceLevel from '../models/experienceLevelModels.js';
import { CompanyVerificationStatus, CommonStatus } from '../enums/masterDataEnums.js';
import CompanyLocation from '../models/companyLocationModels.js';
import Application from '../models/applicationModels.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode, NotificationChannel } from '../enums/notificationEnums.js';
import User from '../models/userModels.js';
import { UserRole } from '../enums/userEnums.js';

const ensureCompanyVerifiedForEmployer = async (userId) => {
  const employerProfile = await EmployerProfile.findOne({ userId }).select('companyId');

  if (!employerProfile) {
    return {
      ok: false,
      statusCode: 404,
      message: 'Employer profile not found'
    };
  }

  if (!employerProfile.companyId) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Employer must have a company'
    };
  }

  const company = await Company.findById(employerProfile.companyId).select('verificationStatus');

  if (!company) {
    return {
      ok: false,
      statusCode: 404,
      message: 'Company not found'
    };
  }

  if (company.verificationStatus !== CompanyVerificationStatus.VERIFIED) {
    return {
      ok: false,
      statusCode: 403,
      message: 'Company must be verified before submitting jobs'
    };
  }

  return {
    ok: true,
    companyId: employerProfile.companyId
  };
};

const attachHiringStats = async (jobs = []) => {
  const jobIds = jobs.map((job) => job?._id).filter(Boolean);
  if (!jobIds.length) return jobs;

  const stats = await Application.aggregate([
    { $match: { jobId: { $in: jobIds } } },
    { $group: { _id: '$jobId', appliedCount: { $sum: 1 } } }
  ]);

  const statsMap = new Map(stats.map((item) => [String(item._id), item.appliedCount || 0]));

  jobs.forEach((job) => {
    const neededCount = Number(job.headcount || 0);
    const appliedCount = statsMap.get(String(job._id)) || 0;
    job.neededCount = neededCount;
    job.appliedCount = appliedCount;
    job.isHiringFull = neededCount > 0 && appliedCount >= neededCount;
    job.remainingSlots = neededCount > 0 ? Math.max(neededCount - appliedCount, 0) : null;
  });

  return jobs;
};
/**
 * @desc Create a new job (draft status)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      careerGroupId,
      careerId,
      careerPositionId,
      jobLevelId,
      experience,
      skills,
      salary,
      workLocations,
      saturdayPolicy,
      description,
      requirements,
      benefits,
      workingTime,
      applyInstruction,
      deadline,
      isUrgent,
      headcount
    } = req.body;

    // Validation
    if (!title || !careerGroupId || !careerId || !careerPositionId || !jobLevelId || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tiêu đề, nhóm nghề, nghề, vị trí chuyên môn, cấp bậc và kinh nghiệm'
      });
    }

    if (!description || !requirements || !benefits || !workingTime || !applyInstruction || !headcount) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: mô tả, yêu cầu, quyền lợi, thời gian làm việc, hướng dẫn ứng tuyển và số lượng cần tuyển'
      });
    }

    if (!deadline) {
      return res.status(400).json({
        success: false,
        message: 'Hạn nộp hồ sơ là bắt buộc'
      });
    }

    // Get employer profile and company
    const employerProfile = await EmployerProfile.findOne({ userId });
    if (!employerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ nhà tuyển dụng'
      });
    }

    if (!employerProfile.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Employer must have a company to create jobs'
      });
    }

    const company = await Company.findById(employerProfile.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy công ty'
      });
    }


    if (company.verificationStatus !== CompanyVerificationStatus.VERIFIED) {
  return res.status(403).json({
    success: false,
    message: 'Company must be verified before creating jobs'
  });
}

    // Create job
    const newJob = new Job({
      companyId: employerProfile.companyId,
      createdBy: userId,
      title,
      careerGroupId: new mongoose.Types.ObjectId(careerGroupId),
      careerId: new mongoose.Types.ObjectId(careerId),
      careerPositionId: new mongoose.Types.ObjectId(careerPositionId),
      jobLevelId: new mongoose.Types.ObjectId(jobLevelId),
      experience,
      skills: skills ? skills.map(id => new mongoose.Types.ObjectId(id)) : [],
      salary: salary || { type: 'NEGOTIABLE' },
      workLocations: workLocations || [],
      saturdayPolicy: saturdayPolicy || 'NOT_SPECIFIED',
      description,
      requirements,
      benefits,
      workingTime,
      applyInstruction,
      deadline: new Date(deadline),
      isUrgent: false, // Must buy a package to make it urgent
      headcount: headcount ? Number(headcount) : 1,
      status: JobStatus.DRAFT
    });

    await newJob.save();

    res.status(201).json({
      success: true,
      message: 'Đã tạo bản nháp việc làm thành công',
      data: newJob
    });
  } catch (error) {
    console.error('[createJob] error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/**
 * @desc Submit a DRAFT job for review (change to PENDING)
 * @route PUT /api/jobs/:jobId/submit
 * @access Private (Employer)
 */
/**
 * @desc Submit a DRAFT job for review (change to PENDING)
 * @route PUT /api/jobs/:jobId/submit
 * @access Private (Employer)
 */
export const submitJobForReview = async (req, res) => {
  
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'ID việc làm không hợp lệ'
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    // Kiểm tra quyền sở hữu
    if (job.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit this job'
      });
    }

    // Chỉ cho phép chuyển từ DRAFT sang PENDING
    if (job.status !== JobStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT jobs can be submitted for review. Current status: ${job.status}`
      });
    }
      const companyCheck = await ensureCompanyVerifiedForEmployer(userId);


    if (!companyCheck.ok) {
  return res.status(companyCheck.statusCode).json({
    success: false,
    message: companyCheck.message
  });
}

    // Cập nhật status
    job.status = JobStatus.PENDING_APPROVAL;
    job.submittedAt = new Date(); // Thêm trường này nếu bạn muốn ghi lại thời gian nộp

    await job.save();

    // Notify admins
    User.find({ role: UserRole.ADMIN }).select('_id').then(admins => {
      admins.forEach(admin => {
        NotificationService.create({
          receiverUserId: admin._id,
          typeCode: NotificationTypeCode.SYSTEM_UPDATE,
          title: 'Tin tuyển dụng chờ duyệt',
          content: `Tin tuyển dụng "${job.title}" vừa được nhà tuyển dụng gửi và đang chờ duyệt.`,
          channels: [NotificationChannel.IN_APP],
          metadata: { actionUrl: '/admin/jobs' }
        }).catch(err => console.error('Notify admin error:', err));
      });
    }).catch(err => console.error('Find admins error:', err));

    res.status(200).json({
      success: true,
      message: 'Đã gửi việc làm để duyệt thành công',
      data: {
        jobId: job._id,
        title: job.title,
        status: job.status,
        submittedAt: job.submittedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Update an existing job (only in draft status)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // 1. Tìm tin tuyển dụng
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    // 2. Kiểm tra quyền sở hữu
    if (job.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật việc làm này'
      });
    }

    // 3. Kiểm tra trạng thái cho phép sửa (Chỉ cho phép sửa khi là DRAFT hoặc PENDING_APPROVAL)
    const allowedStatuses = [JobStatus.DRAFT, JobStatus.PENDING_APPROVAL];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ được phép chỉnh sửa tin tuyển dụng đang ở trạng thái Nháp hoặc Chờ duyệt.'
      });
    }

    // 4. Định nghĩa các nhóm trường để kiểm tra "Quay xe" về chờ duyệt
    // Bao gồm các thông tin cốt lõi ảnh hưởng trực tiếp đến người lao động
    const coreFields = [
      'title', 'salary', 'description', 'requirements', 'benefits', 
      'careerGroupId', 'careerId', 'careerPositionId', 'jobLevelId', 'experience', 'headcount'
    ];

    const allowedUpdates = [
      ...coreFields,
      'skills', 'workLocations', 'saturdayPolicy', 'workingTime', 'applyInstruction',
      'deadline'
    ];

    // Biến cờ đánh dấu xem có sự thay đổi ở trường cốt lõi nào không
    let hasCoreFieldChanged = false;

    // 5. Duyệt qua các trường gửi lên và xử lý cập nhật
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        
        let newValue = updates[field];
        let isFieldChanged = false;

        // --- Bắt đầu chuẩn hóa dữ liệu đầu vào ---
        if (['careerGroupId', 'careerId', 'careerPositionId', 'jobLevelId'].includes(field)) {
          if (newValue && newValue !== "") {
            newValue = new mongoose.Types.ObjectId(newValue);
          } else {
            newValue = null;
          }
          // Kiểm tra thay đổi ObjectId (cần so sánh dạng chuỗi hoặc dùng .equals)
          const currentIdStr = job[field] ? job[field].toString() : '';
          const newIdStr = newValue ? newValue.toString() : '';
          if (currentIdStr !== newIdStr) isFieldChanged = true;

        } else if (field === 'skills' && Array.isArray(newValue)) {
          newValue = newValue
            .filter(id => id && id !== "")
            .map(id => new mongoose.Types.ObjectId(id));
          
          // So sánh mảng (nếu cần bắt chặt chẽ hơn, nhưng skills không nằm trong coreFields nên tạm bỏ qua check biến đổi sâu)

        } else if (field === 'deadline') {
          newValue = newValue ? new Date(newValue) : null;
          const currentTime = job[field] ? new Date(job[field]).getTime() : 0;
          const newTime = newValue ? newValue.getTime() : 0;
          if (currentTime !== newTime) isFieldChanged = true;

        } else if (field === 'salary') {
          // So sánh Object lương sâu (Deep Compare)
          const currentSalary = job.salary || {};
          const newSalary = newValue || {};
          
          if (
            currentSalary.type !== newSalary.type ||
            currentSalary.minMillion !== newSalary.minMillion ||
            currentSalary.maxMillion !== newSalary.maxMillion ||
            currentSalary.currency !== newSalary.currency
          ) {
            isFieldChanged = true;
          }
        } else {
          // So sánh các kiểu dữ liệu thông thường (String, Boolean)
          // Dùng hờ thêm toString() để tránh lệch kiểu dữ liệu hoặc khoảng trắng ngầm
          if (String(job[field]).trim() !== String(newValue).trim()) {
            isFieldChanged = true;
          }
        }

        // --- Kết thúc chuẩn hóa ---

        // Nếu trường này thay đổi và nó nằm trong danh sách trường Cốt lõi (Core)
        if (isFieldChanged && coreFields.includes(field)) {
          hasCoreFieldChanged = true;
        }

        // Gán giá trị mới vào document
        job[field] = newValue;
      }
    });

    // 6. Xử lý chuyển đổi trạng thái nếu tin đang PUBLISHED mà sửa thông tin cốt lõi
    if (job.status === JobStatus.PUBLISHED && hasCoreFieldChanged) {
      job.status = JobStatus.PENDING_APPROVAL;
      job.submittedAt = new Date(); // Đánh dấu ngày gửi duyệt lại tự động
      // Reset các thông tin duyệt cũ để admin xem lại từ đầu
      job.reviewNote = 'Hệ thống tự động chuyển về chờ duyệt do nhà tuyển dụng thay đổi thông tin cốt lõi.';

      // Notify admins
      User.find({ role: UserRole.ADMIN }).select('_id').then(admins => {
        admins.forEach(admin => {
          NotificationService.create({
            receiverUserId: admin._id,
            typeCode: NotificationTypeCode.SYSTEM_UPDATE,
            title: 'Tin tuyển dụng cần duyệt lại',
            content: `Tin tuyển dụng "${job.title}" vừa được cập nhật thông tin cốt lõi và đang chờ duyệt lại.`,
            channels: [NotificationChannel.IN_APP],
            metadata: { actionUrl: '/admin/jobs' }
          }).catch(err => console.error('Notify admin error:', err));
        });
      }).catch(err => console.error('Find admins error:', err));
    }

    // Gửi thông báo khi tin đang PENDING_APPROVAL được chỉnh sửa
    if (job.status === JobStatus.PENDING_APPROVAL) {
      job.submittedAt = new Date(); // Cập nhật thời gian gửi để admin biết có chỉnh sửa mới
      User.find({ role: UserRole.ADMIN }).select('_id').then(admins => {
        admins.forEach(admin => {
          NotificationService.create({
            receiverUserId: admin._id,
            typeCode: NotificationTypeCode.SYSTEM_UPDATE,
            title: 'Tin tuyển dụng chờ duyệt vừa được cập nhật',
            content: `Tin tuyển dụng "${job.title}" đang chờ duyệt vừa được nhà tuyển dụng chỉnh sửa. Vui lòng kiểm tra lại.`,
            channels: [NotificationChannel.IN_APP],
            metadata: { actionUrl: '/admin/jobs' }
          }).catch(err => console.error('Notify admin error:', err));
        });
      }).catch(err => console.error('Find admins error:', err));
    }

    // 7. Lưu lại vào Database
    await job.save();

    // Phản hồi thông điệp rõ ràng cho client biết tin có bị hạ xuống để chờ duyệt hay không
    const customMessage = (job.status === JobStatus.PENDING_APPROVAL)
      ? 'Cập nhật việc làm thành công và chuyển sang chờ duyệt do thay đổi thông tin quan trọng.'
      : 'Cập nhật việc làm thành công.';

    res.status(200).json({
      success: true,
      message: customMessage,
      data: job
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Publish a job (change status from DRAFT to PENDING_APPROVAL)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const publishJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    if (job.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this job'
      });
    }

    if (job.status !== JobStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        message: 'Only draft jobs can be published'
      });
    }

    job.status = JobStatus.PENDING_APPROVAL;
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job submitted for approval',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Delete a job (only in draft status)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    if (job.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa việc làm này'
      });
    }

    if (job.status !== JobStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xóa việc làm ở trạng thái nháp'
      });
    }

    await Job.findByIdAndDelete(jobId);

    res.status(200).json({
      success: true,
      message: 'Xóa việc làm thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Get all jobs created by employer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMyJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, search, location, package: pkg, page = 1, limit = 20 } = req.query;

    const filter = { createdBy: userId };
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    if (location) {
      filter['workLocations.provinceName'] = { $regex: location, $options: 'i' };
    }
    if (pkg === 'GẤP') {
      filter.isUrgent = true;
    } else if (pkg === 'Nổi bật') {
      filter['premium.isActive'] = true;
    } else if (pkg === 'Thường') {
      filter.isUrgent = { $ne: true };
      filter['premium.isActive'] = { $ne: true };
    }

    const jobs = await Job.find(filter)
      .populate('companyId', 'name avatarUrl')
      .populate('careerGroupId', 'name')
      .populate('careerId', 'name')
      .populate('careerPositionId', 'name')
      .populate('jobLevelId', 'name')
      .populate('skills', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Enrich: thêm activeBoost cho mỗi job (nếu có UserServicePackage ACTIVE cho job đó)
    const UserServicePackage = (await import('../models/userServicePackageModels.js')).default;
const jobIds = jobs.map(j => new mongoose.Types.ObjectId(j._id));    
const activeBoosts = await UserServicePackage.find({
      userId,
      status: 'ACTIVE',
      targetType: 'JOB',
      targetId: { $in: jobIds }
    })
      .populate('packageId', 'name code packageType durationDays')
      .select('packageId targetId startedAt expiredAt')
      .lean();

    const boostMap = new Map();
    for (const b of activeBoosts) {
      boostMap.set(b.targetId.toString(), {
        packageId: b.packageId?._id,
        packageName: b.packageId?.name,
        packageCode: b.packageId?.code,
        startedAt: b.startedAt,
        expiredAt: b.expiredAt,
        daysRemaining: b.expiredAt
          ? Math.max(0, Math.ceil((new Date(b.expiredAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null
      });
    }

    const enrichedJobs = jobs.map(j => ({ ...j, activeBoost: boostMap.get(j._id.toString()) || null }));

    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: enrichedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Get a single job by ID (public)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId)
      .populate('companyId')
      .populate('careerGroupId')
      .populate('careerId')
      .populate('careerPositionId')
      .populate('jobLevelId')
      .populate('skills')
      .populate('createdBy', 'fullName email').
      lean();
      
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    const isOwner = req.user && job.createdBy?._id && job.createdBy._id.toString() === req.user.id;

    // Check if job is not public - only creator can view
    if (job.status !== JobStatus.PUBLISHED && (!req.user || job.createdBy._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem việc làm này'
      });
    }

  await attachHiringStats([job]);     // ← dùng job trực tiếp, bỏ jobObject


    // Check if user can apply
    let canApply = true;
    let cannotApplyReason = null;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // SỬA: đổi tất cả jobObject → job trong phần canApply

if (job.status === JobStatus.EXPIRED) {
  canApply = false;
  cannotApplyReason = 'Việc làm đã hết hạn';
} else if (job.status === JobStatus.CLOSED) {
  canApply = false;
  cannotApplyReason = 'Việc làm đã đóng';
} else if (job.status === JobStatus.REJECTED) {
  canApply = false;
  cannotApplyReason = 'Việc làm bị từ chối';
} else if (job.status === JobStatus.BANNED) {
  canApply = false;
  cannotApplyReason = 'Việc làm bị khóa';
} else if (new Date(job.deadline) < startOfToday) {
  canApply = false;
  cannotApplyReason = 'Đã quá hạn nộp hồ sơ';
} else if (job.isHiringFull) {
  canApply = false;
  cannotApplyReason = 'Tin tuyển dụng đã tuyển đủ số lượng';
}

    res.status(200).json({
      success: true,
      data: job,
      canApply,
      cannotApplyReason
    });
  } catch (error) {
console.error("======= CHÍNH LÀ NÓ! LỖI TẠI ĐÂY: =======", error);    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Get all published jobs (public search)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getJobs = async (req, res) => {
  try {
    const {
      search,
      careerGroupId,
      careerId,
      jobLevelId,
      experience,
      salaryMin,
      salaryMax,
      skills,
      companyId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isUrgent,
      isPremium
    } = req.query;

    const filter = { status: JobStatus.PUBLISHED };

    if (isUrgent === 'true') filter.isUrgent = true;
    if (isPremium === 'true') filter['premium.isActive'] = true;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (careerGroupId) filter.careerGroupId = new mongoose.Types.ObjectId(careerGroupId);
    if (careerId) filter.careerId = new mongoose.Types.ObjectId(careerId);
    if (jobLevelId) filter.jobLevelId = new mongoose.Types.ObjectId(jobLevelId);
    if (experience) filter.experience = experience;
    if (companyId) filter.companyId = new mongoose.Types.ObjectId(companyId);

    if (skills && Array.isArray(skills)) {
      filter.skills = { $in: skills.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (salaryMin || salaryMax) {
      filter['salary.type'] = 'RANGE';
      if (salaryMin) filter['salary.minMillion'] = { $gte: parseInt(salaryMin) };
      if (salaryMax) filter['salary.maxMillion'] = { $lte: parseInt(salaryMax) };
    }

    const sortObj = {};
    const validSortFields = ['createdAt', 'title', 'salary.minMillion'];
    const validSortOrder = ['asc', 'desc'];
    sortObj[validSortFields.includes(sortBy) ? sortBy : 'createdAt'] = validSortOrder.includes(sortOrder) ? sortOrder : 'desc';

    const jobs = await Job.find(filter)
      .populate('companyId', 'name avatarUrl')
      .populate('careerGroupId', 'name')
      .populate('careerId', 'name')
      .populate('careerPositionId', 'name')
      .populate('jobLevelId', 'name')
      .populate('skills', 'name')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * @desc Close a job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const closeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    if (job.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đóng việc làm này'
      });
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đóng việc làm đang được hiển thị'
      });
    }

    job.status = JobStatus.CLOSED;
    job.closedAt = new Date();
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Đóng việc làm thành công',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};




const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

export const getPublicJobs = async (req, res) => {
  try {
    const {
      keyword = '',
      location = '',
      careerGroupId,
      careerId,
      experience,
      jobLevelId,
      salaryMin,
      salaryMax,
      saturdayPolicy,
      page = 1,
      limit = 12,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filter = {
      status: JobStatus.PUBLISHED,
      deadline: { $gte: now },
      $or: [
        { bannedReason: null },
        { bannedReason: { $exists: false } }
      ]
    };

    if (keyword.trim()) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: keyword.trim(), $options: 'i' } },
          { description: { $regex: keyword.trim(), $options: 'i' } },
          { requirements: { $regex: keyword.trim(), $options: 'i' } },
          { benefits: { $regex: keyword.trim(), $options: 'i' } }
        ]
      });
    }

    if (location.trim()) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { 'workLocations.provinceName': { $regex: location.trim(), $options: 'i' } },
          { 'workLocations.districtName': { $regex: location.trim(), $options: 'i' } },
          { 'workLocations.wardName': { $regex: location.trim(), $options: 'i' } },
          { 'workLocations.address': { $regex: location.trim(), $options: 'i' } }
        ]
      });
    }

    const careerGroupObjectId = toObjectId(careerGroupId);
    if (careerGroupObjectId) filter.careerGroupId = careerGroupObjectId;

    const careerObjectId = toObjectId(careerId);
    if (careerObjectId) filter.careerId = careerObjectId;

    if (experience) filter.experience = experience;

    const jobLevelObjectId = toObjectId(jobLevelId);
    if (jobLevelObjectId) filter.jobLevelId = jobLevelObjectId;

    if (saturdayPolicy) {
      filter.saturdayPolicy = saturdayPolicy;
    }

    const minSalary = salaryMin ? Number(salaryMin) : null;
    const maxSalary = salaryMax ? Number(salaryMax) : null;

    if (minSalary !== null || maxSalary !== null) {
      filter['salary.type'] = { $ne: 'NEGOTIABLE' };

      if (minSalary !== null && maxSalary !== null) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            {
              'salary.minMillion': { $lte: maxSalary },
              'salary.maxMillion': { $gte: minSalary }
            },
            {
              'salary.minMillion': { $gte: minSalary, $lte: maxSalary },
              'salary.maxMillion': null
            },
            {
              'salary.minMillion': null,
              'salary.maxMillion': { $gte: minSalary, $lte: maxSalary }
            }
          ]
        });
      } else if (minSalary !== null) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { 'salary.maxMillion': { $gte: minSalary } },
            { 'salary.minMillion': { $gte: minSalary } }
          ]
        });
      } else if (maxSalary !== null) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { 'salary.minMillion': { $lte: maxSalary } },
            { 'salary.maxMillion': { $lte: maxSalary } }
          ]
        });
      }
    }

    const { isUrgent } = req.query;
    if (isUrgent === 'true') filter.isUrgent = true;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = isUrgent === 'true'
      ? Math.max(Number(limit) || 1000, 1)
      : Math.min(Math.max(Number(limit) || 12, 1), 50);

    const allowedSortFields = ['publishedAt', 'createdAt', 'deadline', 'salary.minMillion'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'publishedAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('companyId', 'name avatarUrl coverUrl')
        .populate('careerGroupId', 'name')
        .populate('careerId', 'name')
        .populate('careerPositionId', 'name')
        .populate('jobLevelId', 'name')
        .populate('skills', 'name')
        .sort({
          'premium.isActive': -1,
          'premium.packagePrice': -1,
          'premium.startedAt': -1,
          isUrgent: -1,
          [sortField]: sortDirection,
          createdAt: -1
        })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      Job.countDocuments(filter)
    ]);

    await attachHiringStats(jobs);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      },
      filters: {
        keyword,
        location,
        careerGroupId,
        careerId,
        experience,
        jobLevelId,
        salaryMin,
        salaryMax,
        saturdayPolicy,
        sortBy: sortField,
        sortOrder
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};




/**
 * @desc Gợi ý từ khóa tìm kiếm
 * - Có keyword: autocomplete từ title job, tên career, tên career position
 * - Không có keyword: top từ khóa phổ biến từ job PUBLISHED
 * @route GET /jobs/search-suggestions
 * @access Public
 */
export const getSearchSuggestions = async (req, res) => {
  try {
    const { keyword = '', limit = 10 } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const publishedFilter = {
      status: JobStatus.PUBLISHED,
      deadline: { $gte: now },
      $or: [{ bannedReason: null }, { bannedReason: { $exists: false } }]
    };

    if (!keyword.trim()) {
      // Không có keyword → trả top từ khóa phổ biến nhất từ title job PUBLISHED
      const popular = await Job.aggregate([
        { $match: publishedFilter },
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: limitNum },
        { $project: { _id: 0, keyword: '$_id', count: 1, type: { $literal: 'popular' } } }
      ]);

      return res.status(200).json({
        success: true,
        data: popular
      });
    }

    const kw = keyword.trim();
    const regex = { $regex: kw, $options: 'i' };

    // Chạy song song: tìm trong job title, career name, career position name
    const [jobTitles, careers, positions] = await Promise.all([
      Job.aggregate([
        { $match: { ...publishedFilter, title: regex } },
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: limitNum },
        { $project: { _id: 0, keyword: '$_id', count: 1, type: { $literal: 'job_title' } } }
      ]),
      Career.find({ name: regex, status: CommonStatus.ACTIVE })
        .select('name')
        .limit(limitNum)
        .lean(),
      CareerPosition.find({ name: regex, status: CommonStatus.ACTIVE })
        .select('name')
        .limit(limitNum)
        .lean()
    ]);

    const careerSuggestions = careers.map(c => ({ keyword: c.name, type: 'career' }));
    const positionSuggestions = positions.map(p => ({ keyword: p.name, type: 'position' }));

    // Gộp và loại trùng theo keyword (case-insensitive), ưu tiên job_title
    const seen = new Set();
    const results = [];

    for (const item of [...jobTitles, ...careerSuggestions, ...positionSuggestions]) {
      const key = item.keyword.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
      if (results.length >= limitNum) break;
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getPublicJobDetail = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const job = await Job.findOne({
      _id: jobId,
      status: JobStatus.PUBLISHED,
      deadline: { $gte: today },
      $or: [
        { bannedReason: null },
        { bannedReason: '' },
        { bannedReason: { $exists: false } }
      ]
    })
      .populate({
        path: 'companyId',
        select: 'name website industryIds size avatarUrl coverUrl description verificationStatus',
        populate: [
          { path: 'industryIds', select: 'name slug' }
        ]
      })
      .populate('careerGroupId', 'name slug')
      .populate('careerId', 'name slug')
      .populate('careerPositionId', 'name')
      .populate('jobLevelId', 'name')
      .populate('skills', 'name slug')
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Published job not found or no longer available'
      });
    }

    const companyLocations = await CompanyLocation.find({
      companyId: job.companyId._id,
      status: CommonStatus.ACTIVE
    })
      .select('name addressLine province district ward latitude longitude isPrimary')
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    job.companyId.locations = companyLocations;
    await attachHiringStats([job]);

    const canApply = !job.isHiringFull;
    const cannotApplyReason = job.isHiringFull ? 'Tin tuyển dụng đã tuyển đủ số lượng' : null;

    return res.status(200).json({
      success: true,
      data: job,
      canApply,
      cannotApplyReason
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

