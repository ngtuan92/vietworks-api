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
      experienceLevelId,
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
      isUrgent
    } = req.body;

    // Validation
    if (!title || !careerGroupId || !careerId || !careerPositionId || !jobLevelId || !experienceLevelId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tiêu đề, nhóm nghề, nghề, vị trí chuyên môn, cấp bậc và kinh nghiệm'
      });
    }

    if (!description || !requirements || !benefits || !workingTime || !applyInstruction) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: mô tả, yêu cầu, quyền lợi, thời gian làm việc và hướng dẫn ứng tuyển'
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

    // Create job
    const newJob = new Job({
      companyId: employerProfile.companyId,
      createdBy: userId,
      title,
      careerGroupId: new mongoose.Types.ObjectId(careerGroupId),
      careerId: new mongoose.Types.ObjectId(careerId),
      careerPositionId: new mongoose.Types.ObjectId(careerPositionId),
      jobLevelId: new mongoose.Types.ObjectId(jobLevelId),
      experienceLevelId: new mongoose.Types.ObjectId(experienceLevelId),
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
      isUrgent: isUrgent || false,
      status: JobStatus.DRAFT
    });

    await newJob.save();

    res.status(201).json({
      success: true,
      message: 'Đã tạo bản nháp việc làm thành công',
      data: newJob
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
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

    // Cập nhật status
    job.status = JobStatus.PENDING_APPROVAL;
    job.submittedAt = new Date(); // Thêm trường này nếu bạn muốn ghi lại thời gian nộp

    await job.save();

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

    // 3. Kiểm tra trạng thái cho phép sửa (Chỉ cho phép sửa khi là DRAFT hoặc PUBLISHED)
    const allowedStatuses = [JobStatus.DRAFT, JobStatus.PUBLISHED];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only update jobs in draft or published status'
      });
    }

    // 4. Định nghĩa các nhóm trường để kiểm tra "Quay xe" về chờ duyệt
    // Bao gồm các thông tin cốt lõi ảnh hưởng trực tiếp đến người lao động
    const coreFields = [
      'title', 'salary', 'description', 'requirements', 'benefits', 
      'careerGroupId', 'careerId', 'careerPositionId', 'jobLevelId', 'experienceLevelId'
    ];

    const allowedUpdates = [
      ...coreFields,
      'skills', 'workLocations', 'saturdayPolicy', 'workingTime', 'applyInstruction',
      'deadline', 'isUrgent'
    ];

    // Biến cờ đánh dấu xem có sự thay đổi ở trường cốt lõi nào không
    let hasCoreFieldChanged = false;

    // 5. Duyệt qua các trường gửi lên và xử lý cập nhật
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        
        let newValue = updates[field];
        let isFieldChanged = false;

        // --- Bắt đầu chuẩn hóa dữ liệu đầu vào ---
        if (['careerGroupId', 'careerId', 'careerPositionId', 'jobLevelId', 'experienceLevelId'].includes(field)) {
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
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
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
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { createdBy: userId };
    if (status) {
      filter.status = status;
    }

    const jobs = await Job.find(filter)
      .populate('companyId', 'name avatarUrl')
      .populate('careerGroupId', 'name')
      .populate('careerId', 'name')
      .populate('careerPositionId', 'name')
      .populate('jobLevelId', 'name')
      .populate('experienceLevelId', 'name')
      .populate('skills', 'name')
      .sort({ createdAt: -1 })
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
      .populate('experienceLevelId')
      .populate('skills')
      .populate('createdBy', 'fullName email');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    // Check if job is not public - only creator can view
    if (job.status !== JobStatus.PUBLISHED && (!req.user || job.createdBy._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem việc làm này'
      });
    }

    // Check if user can apply
    let canApply = true;
    let cannotApplyReason = null;

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
    } else if (new Date(job.deadline) < new Date()) {
      canApply = false;
      cannotApplyReason = 'Đã quá hạn nộp hồ sơ';
    }

    res.status(200).json({
      success: true,
      data: job,
      canApply,
      cannotApplyReason
    });
  } catch (error) {
    res.status(500).json({
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
      experienceLevelId,
      salaryMin,
      salaryMax,
      skills,
      companyId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { status: JobStatus.PUBLISHED };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (careerGroupId) filter.careerGroupId = new mongoose.Types.ObjectId(careerGroupId);
    if (careerId) filter.careerId = new mongoose.Types.ObjectId(careerId);
    if (jobLevelId) filter.jobLevelId = new mongoose.Types.ObjectId(jobLevelId);
    if (experienceLevelId) filter.experienceLevelId = new mongoose.Types.ObjectId(experienceLevelId);
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
      .populate('experienceLevelId', 'name')
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



