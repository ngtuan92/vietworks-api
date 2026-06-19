import mongoose from 'mongoose';
import Job from '../models/jobModels.js';
import { Company, Cv, UploadedCv } from '../models/index.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';
import { CvStatus } from '../enums/cvEnums.js';
import { JobStatus } from '../enums/jobEnums.js';

const publicJobFilter = () => ({
  status: JobStatus.PUBLISHED,
  deadline: { $gte: new Date() },
  $or: [{ bannedReason: null }, { bannedReason: { $exists: false } }]
});

export const getApplyOptions = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId)
      .populate('companyId', 'name avatarUrl verificationStatus');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        message: 'Việc làm hiện không thể ứng tuyển'
      });
    }

    if (new Date(job.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Việc làm đã hết hạn nộp hồ sơ'
      });
    }

    if ([JobStatus.EXPIRED, JobStatus.CLOSED, JobStatus.BANNED, JobStatus.REJECTED].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Việc làm không còn nhận hồ sơ ứng tuyển'
      });
    }

    const [onlineCvs, uploadedCvs] = await Promise.all([
      Cv.find({ userId: userId, status: CvStatus.ACTIVE })
        .populate('templateId', 'name thumbnailUrl')
        .sort({ isMain: -1, updatedAt: -1 }),
      UploadedCv.find({ userId: userId, status: CvStatus.ACTIVE })
        .sort({ createdAt: -1 })
    ]);

    const cvs = [
      ...onlineCvs.map(cv => ({
        id: cv._id,
        title: cv.title,
        type: 'ONLINE',
        isMain: cv.isMain || false,
        templateName: cv.templateId?.name || null,
        thumbnailUrl: cv.templateId?.thumbnailUrl || null
      })),
      ...uploadedCvs.map(ucv => ({
        id: ucv._id,
        title: ucv.title,
        type: 'UPLOADED',
        fileUrl: ucv.fileUrl,
        fileName: ucv.fileName,
        fileType: ucv.fileType
      }))
    ];

    const workLocations = (job.workLocations || []).map(loc => ({
      provinceCode: loc.provinceCode,
      provinceName: loc.provinceName,
      districtCode: loc.districtCode,
      districtName: loc.districtName,
      wardCode: loc.wardCode,
      wardName: loc.wardName,
      detailAddress: loc.detailAddress
    }));

    const requireLocationSelection = workLocations.length >= 2;

    const personalDataAgreement = {
      text: 'Tôi đã đọc và đồng ý với Thỏa thuận sử dụng dữ liệu cá nhân của Nhà tuyển dụng. Dữ liệu cá nhân của tôi sẽ được xử lý theo chính sách bảo mật của nền tảng.',
      checkboxLabel: 'Tôi đã đọc và đồng ý với Thỏa thuận sử dụng dữ liệu cá nhân',
      required: true
    };

    res.status(200).json({
      success: true,
      data: {
        job: {
          id: job._id,
          title: job.title,
          companyName: job.companyId?.name || 'Công ty chưa xác định',
          companyAvatar: job.companyId?.avatarUrl || null,
          isVerified: job.companyId?.verificationStatus === 'VERIFIED',
          deadline: job.deadline,
          applyInstruction: job.applyInstruction
        },
        cvs,
        workLocations,
        requireLocationSelection,
        personalDataAgreement
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const applyJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { cvId, uploadedCvId, expectedWorkLocation, personalDataAgreementAccepted } = req.body;

    if (!personalDataAgreementAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần đồng ý với thỏa thuận sử dụng dữ liệu cá nhân'
      });
    }

    if (!cvId && !uploadedCvId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn CV để ứng tuyển'
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy việc làm'
      });
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        message: 'Việc làm hiện không thể ứng tuyển'
      });
    }

    if (new Date(job.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Việc làm đã hết hạn nộp hồ sơ'
      });
    }

    const Application = (await import('../models/applicationModels.js')).default;
    const { ApplicationStatus } = await import('../enums/jobEnums.js');

    const existingApplication = await Application.findOne({
      jobId: job._id,
      jobseekerUserId: userId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã ứng tuyển vào công việc này rồi'
      });
    }

    let selectedCv = null;
    if (cvId) {
      selectedCv = await Cv.findOne({ _id: cvId, userId: userId });
    } else if (uploadedCvId) {
      selectedCv = await UploadedCv.findOne({ _id: uploadedCvId, userId: userId });
    }

    if (!selectedCv) {
      return res.status(404).json({
        success: false,
        message: 'CV không tồn tại'
      });
    }

    const application = await Application.create({
      jobId: job._id,
      companyId: job.companyId,
      jobseekerUserId: userId,
      cvId: cvId || null,
      uploadedCvId: uploadedCvId || null,
      expectedWorkLocation: expectedWorkLocation || null,
      status: ApplicationStatus.UNREAD,
      personalDataAgreementAccepted: true,
      statusHistory: [
        {
          status: ApplicationStatus.UNREAD,
          changedAt: new Date(),
          note: 'Ứng viên nộp hồ sơ'
        }
      ]
    });

    try {
      const company = await Company.findById(job.companyId).select('name ownerUserId').lean();
      const jobseekerName = req.user.fullName || req.user.email || 'Ứng viên';

      if (company?.ownerUserId) {
        await NotificationService.create({
          receiverUserId: company.ownerUserId,
          typeCode: NotificationTypeCode.NEW_APPLICATION,
          title: 'Có hồ sơ ứng tuyển mới',
          content: `${jobseekerName} vừa ứng tuyển vào vị trí ${job.title}.`,
          metadata: {
            applicationId: application._id,
            jobId: job._id,
            companyId: job.companyId,
            jobseekerUserId: userId,
            companyName: company.name
          }
        });
      }
    } catch (notificationError) {
      console.error('Create new application notification error:', notificationError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Ứng tuyển thành công',
      data: {
        id: application._id,
        jobId: application.jobId,
        companyId: application.companyId,
        status: application.status,
        appliedAt: application.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const checkDuplicateApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const Application = (await import('../models/applicationModels.js')).default;

    const existingApplication = await Application.findOne({
      jobId: jobId,
      jobseekerUserId: userId
    });

    res.status(200).json({
      success: true,
      data: {
        hasApplied: !!existingApplication,
        applicationId: existingApplication?._id || null,
        appliedAt: existingApplication?.createdAt || null,
        status: existingApplication?.status || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const getApplyCvPreview = async (req, res) => {
  try {
    const { jobId, cvId } = req.params;
    const userId = req.user.id;

    const cv = await Cv.findOne({ _id: cvId, userId })
      .populate('templateId')
      .populate('style.fontId')
      .populate('style.themeColorId')
      .populate('style.backgroundId');

    if (!cv) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        type: 'ONLINE',
        cvData: cv
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const Application = (await import('../models/applicationModels.js')).default;

    const query = { jobseekerUserId: userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('jobId', 'title workLocations salary')
        .populate('companyId', 'name avatarUrl verificationStatus')
        .populate('cvId', 'title templateId')
        .populate('uploadedCvId', 'title fileName fileType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query)
    ]);

    const formattedApplications = applications.map(app => {
      const job = app.jobId;
      const company = app.companyId;
      const cv = app.cvId;
      const uploadedCv = app.uploadedCvId;

      return {
        id: app._id,
        job: {
          id: job?._id,
          title: job?.title || 'Việc đã xóa',
          salary: job?.salary,
          location: job?.workLocations?.[0] ? {
            districtName: job.workLocations[0].districtName,
            provinceName: job.workLocations[0].provinceName
          } : null
        },
        company: {
          id: company?._id,
          name: company?.name || 'Công ty đã xóa',
          avatarUrl: company?.avatarUrl || null,
          isVerified: company?.verificationStatus === 'VERIFIED'
        },
        appliedAt: app.createdAt,
        status: app.status,
        cv: cv ? {
          id: cv._id,
          title: cv.title,
          type: 'ONLINE'
        } : uploadedCv ? {
          id: uploadedCv._id,
          title: uploadedCv.title,
          fileName: uploadedCv.fileName,
          type: 'UPLOADED'
        } : null,
        viewedAt: app.viewedAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        applications: formattedApplications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const getSimilarAppliedJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 6 } = req.query;
    const limitNum = Math.min(Number(limit) || 6, 20);

    const Application = (await import('../models/applicationModels.js')).default;

    // Lấy ngành nghề từ các job đã ứng tuyển
    const applied = await Application.find({ jobseekerUserId: userId })
      .populate('jobId', 'careerGroupId careerId')
      .lean();

    const careerGroupIds = [...new Set(applied.map((a) => a.jobId?.careerGroupId?.toString()).filter(Boolean))];
    const careerIds = [...new Set(applied.map((a) => a.jobId?.careerId?.toString()).filter(Boolean))];
    const appliedJobIds = applied.map((a) => a.jobId?._id).filter(Boolean);

    if (!careerGroupIds.length && !careerIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const jobs = await Job.find({
      ...publicJobFilter(),
      _id: { $nin: appliedJobIds },
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
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const Application = (await import('../models/applicationModels.js')).default;

    const application = await Application.findOne({
      _id: id,
      jobseekerUserId: userId
    })
      .populate('jobId', 'title workLocations salary')
      .populate('companyId', 'name avatarUrl verificationStatus')
      .populate('cvId', 'title templateId')
      .populate('uploadedCvId', 'title fileName fileType');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    const job = application.jobId;
    const company = application.companyId;
    const cv = application.cvId;
    const uploadedCv = application.uploadedCvId;

    res.status(200).json({
      success: true,
      data: {
        id: application._id,
        job: {
          id: job?._id,
          title: job?.title || 'Việc đã xóa',
          salary: job?.salary,
          location: job?.workLocations?.[0] ? {
            districtName: job.workLocations[0].districtName,
            provinceName: job.workLocations[0].provinceName
          } : null
        },
        company: {
          id: company?._id,
          name: company?.name || 'Công ty đã xóa',
          avatarUrl: company?.avatarUrl || null,
          isVerified: company?.verificationStatus === 'VERIFIED'
        },
        appliedAt: application.createdAt,
        status: application.status,
        viewedAt: application.viewedAt,
        approvedMessage: application.approvedMessage,
        rejectionReason: application.rejectionReason,
        statusHistory: application.statusHistory || [],
        cv: cv ? {
          id: cv._id,
          title: cv.title,
          type: 'ONLINE'
        } : uploadedCv ? {
          id: uploadedCv._id,
          title: uploadedCv.title,
          fileName: uploadedCv.fileName,
          type: 'UPLOADED'
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};



