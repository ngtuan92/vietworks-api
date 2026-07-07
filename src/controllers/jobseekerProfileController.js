import User from '../models/userModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import { UserRole } from '../enums/userEnums.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';

// Notification types relevant to Jobseeker with display metadata
const JOBSEEKER_NOTIFICATION_TYPES = [
  {
    typeCode: NotificationTypeCode.EMPLOYER_VIEWED_CV,
    label: 'Nhà tuyển dụng đã xem CV của tôi',
    description: 'Nhận thông báo khi NTD mở và đọc CV bạn đã nộp.',
    group: 'Hồ sơ & Ứng tuyển',
  },
  {
    typeCode: NotificationTypeCode.INTERVIEW_INVITATION,
    label: 'Lời mời phỏng vấn từ nhà tuyển dụng',
    description: 'Nhận thông báo khi bạn được mời phỏng vấn hoặc nhận việc.',
    group: 'Hồ sơ & Ứng tuyển',
  },
  {
    typeCode: NotificationTypeCode.APPLICATION_RESULT,
    label: 'Kết quả ứng tuyển (Từ chối / Chấp nhận)',
    description: 'Nhận thông báo khi NTD cập nhật trạng thái hồ sơ của bạn.',
    group: 'Hồ sơ & Ứng tuyển',
  },
  {
    typeCode: NotificationTypeCode.MATCHING_JOB,
    label: 'Gợi ý việc làm phù hợp với nhu cầu',
    description: 'Nhận thông báo khi hệ thống tìm thấy việc làm khớp với nhu cầu của bạn.',
    group: 'Việc làm & Khám phá',
  },
  {
    typeCode: NotificationTypeCode.NEW_CV_TEMPLATE,
    label: 'Mẫu CV mới ra mắt',
    description: 'Nhận thông báo khi Admin thêm template CV mới vào thư viện.',
    group: 'Việc làm & Khám phá',
  },
  {
    typeCode: NotificationTypeCode.PAYMENT_SUCCESS,
    label: 'Thanh toán thành công',
    description: 'Nhận thông báo khi giao dịch nạp ví hoặc mua gói thành công.',
    group: 'Thanh toán & Dịch vụ',
  },
  {
    typeCode: NotificationTypeCode.PAYMENT_FAILED,
    label: 'Thanh toán thất bại',
    description: 'Nhận thông báo khi giao dịch không thành công hoặc bị hủy.',
    group: 'Thanh toán & Dịch vụ',
  },
  {
    typeCode: NotificationTypeCode.PACKAGE_PURCHASE_SUCCESS,
    label: 'Kích hoạt gói dịch vụ thành công',
    description: 'Nhận thông báo khi gói Boost CV hoặc Premium được kích hoạt.',
    group: 'Thanh toán & Dịch vụ',
  },
];

const buildDefaultSettings = () =>
  JOBSEEKER_NOTIFICATION_TYPES.map((t) => ({
    typeCode: t.typeCode,
    inApp: true,
    email: true,
  }));

export const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== UserRole.JOBSEEKER) {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên mới được truy cập' });
    }

    const [user, profile] = await Promise.all([
      User.findById(req.user._id).select('fullName email phone accountStatus authProvider createdAt'),
      JobseekerProfile.findOne({ userId: req.user._id }).select(
        'avatarUrl profileVisibility allowEmployerSearch desiredJob skills boost notificationSettings'
      )
        .populate('desiredJob.careerGroupId', 'name')
        .populate('desiredJob.careerId', 'name')
        .populate('desiredJob.careerPositionId', 'name')
        .populate('desiredJob.jobLevelId', 'name')
        .populate('skills', 'name')
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        accountStatus: user.accountStatus,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
        avatarUrl: profile?.avatarUrl || null,
        profileVisibility: profile?.profileVisibility || 'PUBLIC',
        allowEmployerSearch: profile?.allowEmployerSearch ?? true,
        desiredJob: profile?.desiredJob || null,
        skills: profile?.skills || [],
        boost: profile?.boost || null,
        notificationSettings: profile?.notificationSettings || [],
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getNotificationSettings = async (req, res) => {
  try {
    if (req.user.role !== UserRole.JOBSEEKER) {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên mới được truy cập' });
    }

    const profile = await JobseekerProfile.findOne({ userId: req.user._id }).select('notificationSettings');
    const saved = profile?.notificationSettings || [];

    // Merge saved settings with defaults (add new types if not yet in saved)
    const merged = JOBSEEKER_NOTIFICATION_TYPES.map((meta) => {
      const existing = saved.find((s) => s.typeCode === meta.typeCode);
      return {
        typeCode: meta.typeCode,
        label: meta.label,
        description: meta.description,
        group: meta.group,
        inApp: existing?.inApp ?? true,
        email: existing?.email ?? true,
      };
    });

    return res.status(200).json({ success: true, data: merged });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    if (req.user.role !== UserRole.JOBSEEKER) {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên mới được truy cập' });
    }

    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'settings phải là mảng' });
    }

    const validCodes = new Set(JOBSEEKER_NOTIFICATION_TYPES.map((t) => t.typeCode));
    const cleaned = settings
      .filter((s) => validCodes.has(s.typeCode))
      .map((s) => ({
        typeCode: s.typeCode,
        inApp: typeof s.inApp === 'boolean' ? s.inApp : true,
        email: typeof s.email === 'boolean' ? s.email : true,
      }));

    // Ensure all types are present (fill missing with defaults)
    const merged = JOBSEEKER_NOTIFICATION_TYPES.map((meta) => {
      const found = cleaned.find((s) => s.typeCode === meta.typeCode);
      return found || { typeCode: meta.typeCode, inApp: true, email: true };
    });

    await JobseekerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { notificationSettings: merged },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Cài đặt thông báo đã được lưu thành công.',
      data: merged,
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updatePrivacySettings = async (req, res) => {
  try {
    if (req.user.role !== UserRole.JOBSEEKER) {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên mới được truy cập' });
    }

    const { allowEmployerSearch } = req.body;

    if (typeof allowEmployerSearch !== 'boolean') {
      return res.status(400).json({ success: false, message: 'allowEmployerSearch phải là boolean' });
    }

    const profileVisibility = allowEmployerSearch ? 'PUBLIC' : 'PRIVATE';

    const profile = await JobseekerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { allowEmployerSearch, profileVisibility },
      { new: true, upsert: true, select: 'allowEmployerSearch profileVisibility' }
    );

    return res.status(200).json({
      success: true,
      message: allowEmployerSearch
        ? 'Hồ sơ đã được đặt công khai. Nhà tuyển dụng có thể tìm thấy bạn.'
        : 'Hồ sơ đã được ẩn. Nhà tuyển dụng không thể chủ động tìm thấy bạn.',
      data: {
        allowEmployerSearch: profile.allowEmployerSearch,
        profileVisibility: profile.profileVisibility,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    if (req.user.role !== UserRole.JOBSEEKER) {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên mới được truy cập' });
    }

    const { fullName, phone, avatarUrl } = req.body;

    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Họ tên không được để trống' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { fullName: fullName.trim(), phone: phone?.trim() || '' },
      { new: true, select: 'fullName email phone accountStatus' }
    );

    // Ảnh đại diện được lưu trên JobseekerProfile (chỉ cập nhật khi client gửi lên).
    let savedAvatarUrl;
    if (avatarUrl !== undefined) {
      const updatedProfile = await JobseekerProfile.findOneAndUpdate(
        { userId: req.user._id },
        { avatarUrl: avatarUrl || null },
        { new: true, upsert: true, select: 'avatarUrl' }
      );
      savedAvatarUrl = updatedProfile?.avatarUrl ?? null;
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công',
      data: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        accountStatus: updatedUser.accountStatus,
        ...(avatarUrl !== undefined ? { avatarUrl: savedAvatarUrl } : {}),
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

