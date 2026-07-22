import mongoose from 'mongoose';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { v2 as cloudinary } from 'cloudinary';
import { Application, Company, Cv, Job, UploadedCv, JobseekerProfile } from '../models/index.js';
import User from '../models/userModels.js';
import { ApplicationStatus, JobStatus } from '../enums/jobEnums.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';
import NotificationService from '../services/notificationService.js';

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const STATUS_FOR_STATS = [
  ApplicationStatus.UNREAD,
  ApplicationStatus.APPLIED,
  ApplicationStatus.VIEWED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.HIRED
];

const getEmployerCompanyIds = async (employerUserId) => {
  const companies = await Company.find({ ownerUserId: employerUserId }).select('_id name avatarUrl').lean();
  return companies.map((company) => company._id);
};

const ensureEmployerOwnsJob = async (jobId, employerUserId) => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

  const companyIds = await getEmployerCompanyIds(employerUserId);
  if (!companyIds.length) return null;

  return Job.findOne({ _id: jobId, companyId: { $in: companyIds } })
    .populate('companyId', 'name avatarUrl ownerUserId')
    .lean();
};

const findApplicationForEmployer = async (applicationId, employerUserId) => {
  if (!mongoose.Types.ObjectId.isValid(applicationId)) return null;

  const companyIds = await getEmployerCompanyIds(employerUserId);
  if (!companyIds.length) return null;

  return Application.findOne({ _id: applicationId, companyId: { $in: companyIds } })
    .populate('jobId', 'title status deadline workLocations companyId')
    .populate('companyId', 'name avatarUrl ownerUserId')
    .populate('jobseekerUserId', 'fullName email phone')
    .populate('cvId', 'title templateId sections style updatedAt')
    .populate('uploadedCvId', 'title fileName fileUrl fileType fileSize updatedAt')
    .lean();
};

const countApplicationsByStatus = async (match) => {
  const grouped = await Application.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const stats = { total: 0 };
  STATUS_FOR_STATS.forEach((status) => { stats[status] = 0; });

  grouped.forEach((item) => {
    stats[item._id] = item.count;
    stats.total += item.count;
  });

  return stats;
};

const formatLocation = (location) => {
  if (!location) return 'Chưa chọn';
  return [location.detailAddress, location.wardName, location.districtName, location.provinceName]
    .filter(Boolean)
    .join(', ') || 'Chưa chọn';
};

const getCvInfo = (application) => {
  if (application.uploadedCvId) {
    return {
      type: 'UPLOADED',
      id: toId(application.uploadedCvId),
      title: application.uploadedCvId.title || application.uploadedCvId.fileName || 'CV đã tải lên',
      fileName: application.uploadedCvId.fileName,
      fileUrl: application.uploadedCvId.fileUrl,
      fileType: application.uploadedCvId.fileType
    };
  }

  if (application.cvId) {
    return {
      type: 'ONLINE',
      id: toId(application.cvId),
      title: application.cvId.title || 'CV online',
      sections: application.cvId.sections || []
    };
  }

  return { type: 'UNKNOWN', id: null, title: 'Chưa có CV' };
};

const buildCvViewUrl = (applicationId, cv) => {
  if (cv?.type !== 'UPLOADED' || !cv?.id) return null;
  return `/api/employer/applications/${applicationId}/cv-view`;
};

const formatApplicationListItem = (application) => {
  const jobseeker = application.jobseekerUserId || {};
  const cv = getCvInfo(application);

  return {
    id: toId(application),
    applicationId: toId(application),
    jobId: toId(application.jobId),
    jobTitle: application.jobId?.title || 'Tin tuyển dụng',
    candidateName: jobseeker.fullName || 'Ứng viên',
    candidateEmail: jobseeker.email || null,
    avatar: application.avatarUrl || (jobseeker.fullName || 'Ứng viên').trim().charAt(0).toUpperCase(),
    cv,
    cvName: cv.title,
    cvViewUrl: buildCvViewUrl(toId(application), cv),
    expectedWorkLocation: application.expectedWorkLocation,
    desiredLocation: formatLocation(application.expectedWorkLocation),
    status: application.status,
    coverLetter: application.coverLetter,
    appliedAt: application.createdAt,
    viewedAt: application.viewedAt
  };
};

export const getEmployerAtsJobs = async (req, res) => {
  try {
    const companyIds = await getEmployerCompanyIds(req.user._id);

    if (!companyIds.length) {
      return res.json({ success: true, data: [] });
    }

    const jobs = await Job.find({ companyId: { $in: companyIds } })
      .populate('companyId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = jobs.map((job) => job._id);
    const statsByJob = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: { jobId: '$jobId', status: '$status' }, count: { $sum: 1 } } }
    ]);

    const statsMap = new Map();
    statsByJob.forEach((item) => {
      const jobKey = item._id.jobId.toString();
      if (!statsMap.has(jobKey)) {
        const base = { total: 0 };
        STATUS_FOR_STATS.forEach((status) => { base[status] = 0; });
        statsMap.set(jobKey, base);
      }
      const stats = statsMap.get(jobKey);
      stats[item._id.status] = item.count;
      stats.total += item.count;
    });

    const data = jobs.map((job) => ({
      id: toId(job),
      jobId: toId(job),
      title: job.title,
      company: job.companyId ? { id: toId(job.companyId), name: job.companyId.name, avatarUrl: job.companyId.avatarUrl } : null,
      status: job.status,
      deadline: job.deadline,
      applicationCount: statsMap.get(toId(job))?.total || 0,
      stats: statsMap.get(toId(job)) || { total: 0, UNREAD: 0, APPLIED: 0, VIEWED: 0, APPROVED: 0, REJECTED: 0, HIRED: 0 }
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách job ATS' });
  }
};

export const getApplicationsByJob = async (req, res) => {
  try {
    const job = await ensureEmployerOwnsJob(req.params.jobId, req.user._id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy job hoặc bạn không có quyền xem' });
    }

    const { status, search } = req.query;
    const query = { jobId: job._id };
    
    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);
      query.jobseekerUserId = { $in: userIds };
    }

    const applications = await Application.find(query)
      .populate('jobId', 'title status deadline')
      .populate('jobseekerUserId', 'fullName email phone')
      .populate('cvId', 'title sections updatedAt')
      .populate('uploadedCvId', 'title fileName fileUrl fileType fileSize updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const userIds = applications.map(app => app.jobseekerUserId?._id).filter(Boolean);
    const profiles = await JobseekerProfile.find({ userId: { $in: userIds } }).select('userId avatarUrl').lean();
    const profileMap = profiles.reduce((acc, profile) => {
      acc[profile.userId.toString()] = profile.avatarUrl;
      return acc;
    }, {});

    const applicationsWithAvatar = applications.map(app => {
      if (app.jobseekerUserId) {
        app.avatarUrl = profileMap[app.jobseekerUserId._id.toString()];
      }
      return formatApplicationListItem(app);
    });

    const stats = await countApplicationsByStatus({ jobId: job._id });

    res.json({
      success: true,
      data: applicationsWithAvatar,
      job: {
        id: toId(job),
        title: job.title,
        status: job.status,
        deadline: job.deadline,
        company: job.companyId ? { id: toId(job.companyId), name: job.companyId.name, avatarUrl: job.companyId.avatarUrl } : null
      },
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách hồ sơ ứng tuyển' });
  }
};

export const getEmployerApplicationDetail = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc bạn không có quyền xem' });
    }

    if (application.jobseekerUserId) {
      const profile = await JobseekerProfile.findOne({ userId: application.jobseekerUserId._id }).select('avatarUrl').lean();
      if (profile) application.avatarUrl = profile.avatarUrl;
    }

    res.json({
      success: true,
      data: {
        ...formatApplicationListItem(application),
        job: application.jobId,
        company: application.companyId,
        jobseeker: application.jobseekerUserId,
        statusHistory: application.statusHistory || [],
        approvedMessage: application.approvedMessage,
        rejectionReason: application.rejectionReason,
        personalDataAgreementAccepted: application.personalDataAgreementAccepted
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải chi tiết hồ sơ ứng tuyển' });
  }
};

export const markApplicationAsViewed = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc bạn không có quyền xem' });
    }

    let updated = application;
    const shouldMarkViewed = [ApplicationStatus.UNREAD, ApplicationStatus.APPLIED].includes(application.status);

    if (shouldMarkViewed) {
      updated = await Application.findByIdAndUpdate(
        application._id,
        {
          $set: { status: ApplicationStatus.VIEWED, viewedAt: new Date() },
          $push: {
            statusHistory: {
              status: ApplicationStatus.VIEWED,
              changedBy: req.user._id,
              changedAt: new Date(),
              note: 'Nhà tuyển dụng đã xem hồ sơ'
            }
          }
        },
        { new: true }
      )
        .populate('jobId', 'title status deadline workLocations companyId')
        .populate('companyId', 'name avatarUrl ownerUserId')
        .populate('jobseekerUserId', 'fullName email phone')
        .populate('cvId', 'title templateId sections style updatedAt')
        .populate('uploadedCvId', 'title fileName fileUrl fileType fileSize updatedAt')
        .lean();

      const companyName = updated.companyId?.name || 'Nhà tuyển dụng';
      const jobTitle = updated.jobId?.title || 'vị trí đã ứng tuyển';

      await NotificationService.create({
        receiverUserId: updated.jobseekerUserId._id,
        typeCode: NotificationTypeCode.EMPLOYER_VIEWED_CV,
        title: 'Nhà tuyển dụng đã xem CV của bạn',
        content: `${companyName} đã xem CV của bạn cho vị trí ${jobTitle}.`,
        metadata: {
          applicationId: toId(updated),
          jobId: toId(updated.jobId),
          jobTitle: jobTitle,
          companyId: toId(updated.companyId),
          companyName: companyName,
          companyLogo: updated.companyId?.avatarUrl,
          employerUserId: toId(req.user)
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...formatApplicationListItem(updated),
        job: updated.jobId,
        company: updated.companyId,
        jobseeker: updated.jobseekerUserId,
        statusHistory: updated.statusHistory || []
      },
      notificationCreated: shouldMarkViewed,
      message: shouldMarkViewed ? 'Đã chuyển hồ sơ sang trạng thái đã xem' : 'Hồ sơ đã được xem trước đó'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái hồ sơ' });
  }
};



export const previewEmployerApplicationCv = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Kh?ng t?m th?y h? s? ho?c b?n kh?ng c? quy?n xem' });
    }

    if (!application.uploadedCvId) {
      return res.status(400).json({ success: false, message: 'H? s? n?y kh?ng d?ng CV upload ?? preview tr?c ti?p' });
    }

    const uploadedCv = application.uploadedCvId;
    const isImageType = uploadedCv.fileUrl.includes('/image/upload/');
    let pdfBuffer;

    if (isImageType) {
      const match = uploadedCv.fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (!match) throw new Error('Invalid file URL');
      const publicId = match[1].replace(/\.[^/.]+$/, '');

      const archiveUrl = cloudinary.utils.download_archive_url({
        public_ids: [publicId],
        resource_type: 'image',
        flatten_folders: true,
        type: 'upload'
      });

      const response = await axios.get(archiveUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const zip = new AdmZip(Buffer.from(response.data));
      const entries = zip.getEntries();
      pdfBuffer = zip.readFile(entries[0]);
    } else {
      const response = await axios.get(uploadedCv.fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
      pdfBuffer = Buffer.from(response.data);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${uploadedCv.fileName || 'cv.pdf'}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('previewEmployerApplicationCv error:', error.message);
    res.status(500).json({ success: false, message: 'Không thể tải file CV để xem trước' });
  }
};

export const approveApplication = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc bạn không có quyền' });
    }

    if (application.status === ApplicationStatus.REJECTED || application.status === ApplicationStatus.APPROVED) {
      return res.status(400).json({ success: false, message: 'Hồ sơ đã được xử lý trước đó' });
    }

    const { note } = req.body;

    const updated = await Application.findByIdAndUpdate(
      application._id,
      {
        $set: { status: ApplicationStatus.APPROVED, approvedMessage: note },
        $push: {
          statusHistory: {
            status: ApplicationStatus.APPROVED,
            changedBy: req.user._id,
            changedAt: new Date(),
            note: note || 'Hồ sơ phù hợp'
          }
        }
      },
      { new: true }
    )
      .populate('jobId', 'title')
      .populate('companyId', 'name avatarUrl')
      .populate('jobseekerUserId', '_id');

    const companyName = updated.companyId?.name || 'Nhà tuyển dụng';
    const jobTitle = updated.jobId?.title || 'vị trí ứng tuyển';

    await NotificationService.create({
      receiverUserId: updated.jobseekerUserId._id,
      typeCode: NotificationTypeCode.APPLICATION_RESULT,
      title: 'Hồ sơ của bạn đã vượt qua vòng lọc CV!',
      content: `Chúc mừng! Hồ sơ của bạn ứng tuyển vào vị trí ${jobTitle} tại ${companyName} đã được đánh giá phù hợp. Vui lòng chờ thông tin phỏng vấn tiếp theo.`,
      metadata: {
        applicationId: toId(updated),
        jobId: toId(updated.jobId),
        jobTitle: jobTitle,
        companyId: toId(updated.companyId),
        companyName: companyName,
        companyLogo: updated.companyId?.avatarUrl,
        status: 'APPROVED',
        employerUserId: toId(req.user)
      }
    });

    // Auto-close job if fully hired
    if (updated.jobId && updated.jobId._id) {
      const job = await Job.findById(updated.jobId._id);
      if (job && job.headcount > 0 && job.status === JobStatus.PUBLISHED) {
        const currentHiredCount = await Application.countDocuments({
          jobId: job._id,
          status: ApplicationStatus.APPROVED
        });
        if (currentHiredCount >= job.headcount) {
          await Job.findByIdAndUpdate(job._id, {
            status: JobStatus.CLOSED,
            closedAt: new Date()
          });
        }
      }
    }

    res.json({ success: true, message: 'Đã duyệt hồ sơ', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi duyệt hồ sơ' });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc bạn không có quyền' });
    }

    if (application.status === ApplicationStatus.REJECTED) {
      return res.status(400).json({ success: false, message: 'Hồ sơ đã bị từ chối trước đó' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Bắt buộc phải nhập lý do từ chối' });
    }

    const updated = await Application.findByIdAndUpdate(
      application._id,
      {
        $set: { status: ApplicationStatus.REJECTED, rejectionReason: reason },
        $push: {
          statusHistory: {
            status: ApplicationStatus.REJECTED,
            changedBy: req.user._id,
            changedAt: new Date(),
            note: reason
          }
        }
      },
      { new: true }
    )
      .populate('jobId', 'title')
      .populate('companyId', 'name avatarUrl')
      .populate('jobseekerUserId', '_id');

    const companyName = updated.companyId?.name || 'Nhà tuyển dụng';
    const jobTitle = updated.jobId?.title || 'vị trí ứng tuyển';

    await NotificationService.create({
      receiverUserId: updated.jobseekerUserId._id,
      typeCode: NotificationTypeCode.APPLICATION_RESULT,
      title: 'Cập nhật kết quả ứng tuyển',
      content: `Rất tiếc, hồ sơ của bạn ứng tuyển vào vị trí ${jobTitle} tại ${companyName} chưa phù hợp với yêu cầu hiện tại.`,
      metadata: {
        applicationId: toId(updated),
        jobId: toId(updated.jobId),
        jobTitle: jobTitle,
        companyId: toId(updated.companyId),
        companyName: companyName,
        companyLogo: updated.companyId?.avatarUrl,
        status: 'REJECTED',
        reason: reason,
        employerUserId: toId(req.user)
      }
    });

    res.json({ success: true, message: 'Đã từ chối hồ sơ', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi từ chối hồ sơ' });
  }
};

export const createInterviewInvitation = async (req, res) => {
  try {
    const application = await findApplicationForEmployer(req.params.id, req.user._id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc bạn không có quyền' });
    }

    const { interviewTime, interviewType, location, contactPerson, contactPhone, note } = req.body;
    if (!interviewTime || !interviewType || !location) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (thời gian, hình thức, địa điểm)' });
    }

    const interviewInvitation = {
      interviewTime,
      interviewType,
      location,
      contactPerson,
      contactPhone,
      note,
      createdAt: new Date()
    };

    const updated = await Application.findByIdAndUpdate(
      application._id,
      {
        $set: { 
          status: ApplicationStatus.INTERVIEW_INVITED,
          interviewInvitation 
        },
        $push: {
          statusHistory: {
            status: ApplicationStatus.INTERVIEW_INVITED,
            changedBy: req.user._id,
            changedAt: new Date(),
            note: 'Gửi lời mời phỏng vấn'
          }
        }
      },
      { new: true }
    )
      .populate('jobId', 'title')
      .populate('companyId', 'name avatarUrl')
      .populate('jobseekerUserId', '_id fullName email');

    const companyName = updated.companyId?.name || 'Nhà tuyển dụng';
    const jobTitle = updated.jobId?.title || 'vị trí ứng tuyển';

    await NotificationService.create({
      receiverUserId: updated.jobseekerUserId._id,
      typeCode: NotificationTypeCode.INTERVIEW_INVITATION,
      title: 'Bạn nhận được lời mời phỏng vấn mới 🎉',
      content: `${companyName} vừa gửi cho bạn một lời mời phỏng vấn cho vị trí ${jobTitle}.`,
      metadata: {
        applicationId: toId(updated),
        jobId: toId(updated.jobId),
        jobTitle: jobTitle,
        companyId: toId(updated.companyId),
        companyName: companyName,
        companyLogo: updated.companyId?.avatarUrl,
        interviewTime,
        interviewType,
        location,
        contactPerson,
        contactPhone,
        note,
        employerUserId: toId(req.user)
      }
    });

    res.json({ success: true, message: 'Đã gửi lời mời phỏng vấn', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi gửi lời mời phỏng vấn' });
  }
};
