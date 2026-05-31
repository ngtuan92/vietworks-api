import Job from '../models/jobModels.js';
import { Cv, UploadedCv } from '../models/index.js';
import { CvStatus } from '../enums/cvEnums.js';
import { JobStatus } from '../enums/jobEnums.js';

export const getApplyOptions = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId)
      .populate('companyId', 'name avatarUrl verificationStatus');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        message: 'Job is not available for application'
      });
    }

    if (new Date(job.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Job deadline has passed'
      });
    }

    if ([JobStatus.EXPIRED, JobStatus.CLOSED, JobStatus.BANNED, JobStatus.REJECTED].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Job is no longer accepting applications'
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
      text: 'Tôi đã đọc và đồng ý với Thoả thuận sử dụng dữ liệu cá nhân của Nhà tuyển dụng. Dữ liệu cá nhân của tôi sẽ được xử lý theo chính sách bảo mật của nền tảng.',
      checkboxLabel: 'Tôi đã đọc và đồng ý với Thoả thuận sử dụng dữ liệu cá nhân',
      required: true
    };

    res.status(200).json({
      success: true,
      data: {
        job: {
          id: job._id,
          title: job.title,
          companyName: job.companyId?.name || 'Unknown Company',
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
      message: error.message
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
        message: 'Job not found'
      });
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        message: 'Job is not available for application'
      });
    }

    if (new Date(job.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Job deadline has passed'
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
      status: ApplicationStatus.APPLIED,
      personalDataAgreementAccepted: true,
      statusHistory: [
        {
          status: ApplicationStatus.APPLIED,
          changedAt: new Date(),
          note: 'Ứng viên nộp hồ sơ'
        }
      ]
    });

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
      message: error.message
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
      message: error.message
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
        message: 'CV not found or access denied'
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
      message: error.message
    });
  }
};

