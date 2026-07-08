import Job from '../models/jobModels.js'; // Thay đổi đường dẫn theo đúng cấu trúc thư mục của bạn
import { JobStatus } from '../enums/jobEnums.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';

const jobAdminController = {
  /**
   * 1. Lấy danh sách tin tuyển dụng đang chờ duyệt (PENDING_APPROVAL)
   * Hỗ trợ phân trang và tìm kiếm theo tiêu đề tin
   */
 getAllJobsPending: async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    // LẤY TRỰC TIẾP TỪ REQ.QUERY (Không gán || mặc định ở đây nữa)
    const status = req.query.status; 
    
    const skip = (page - 1) * limit;

    // Xây dựng query filter linh hoạt
    const query = {
      ...(search && { title: { $regex: search, $options: 'i' } })
    };

    // LOGIC MỚI: 
    // 1. Nếu frontend truyền status cụ thể (ví dụ: 'PUBLISHED', 'BANNED'...) -> Lọc theo trạng thái đó.
    // 2. Nếu frontend truyền chuỗi rỗng "" hoặc undefined (Admin chọn "Tất cả trạng thái") -> KHÔNG thêm status vào query (sẽ lấy tất cả).
    // 3. Nếu frontend KHÔNG TRUYỀN HOÀN TOÀN (req.query.status === undefined - ví dụ khi gọi ở một trang ẩn nào khác cần mặc định) 
    //    thì bạn có thể cân nhắc xử lý, nhưng ở đây tối ưu nhất cho bộ lọc filter là:
    if (status) {
      query.status = status;
    } else if (status === undefined && !search) {
      // Trường hợp trang mới tải lần đầu, chưa bấm filter gì cả, muốn mặc định hiện PENDING
      // Bạn có thể bật dòng dưới nếu muốn vào trang là chỉ thấy tin chờ duyệt luôn:
      // query.status = 'PENDING'; 
    }

    // Thực hiện đếm tổng số bản ghi và lấy dữ liệu đồng thời
    const [jobs, totalJobs] = await Promise.all([
      Job.find(query)
        .populate('companyId', 'name logo')
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalJobs / limit);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: { page, limit, total: totalJobs, pages: totalPages }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách công việc: ' + error.message
    });
  }
},
  /**
   * 2. XEM CHI TIẾT MỘT CÔNG VIỆC (MỚI BỔ SUNG)
   * Lấy toàn bộ thông tin chi tiết bao gồm thông tin liên kết phục vụ cho việc hiển thị/đánh giá của Admin
   */
  getJobById: async (req, res) => {
    try {
      const { jobId } = req.params;

      const job = await Job.findById(jobId)
        .populate('companyId', 'name logo website scale description') // Thông tin công ty
        .populate('createdBy', 'fullName email phone') // Người tạo tin
        .populate('careerGroupId', 'name') // Nhóm ngành
        .populate('careerId', 'name') // Ngành nghề chi tiết
        .populate('careerPositionId', 'name') // Vị trí chuyên môn
        .populate('jobLevelId', 'name') // Cấp bậc
        .populate('skills', 'name') // Danh sách các kỹ năng yêu cầu
        .populate('reviewedBy', 'fullName email'); // Admin đã duyệt trước đó (nếu có)

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin tuyển dụng hoặc tin đã bị xóa khỏi hệ thống.'
        });
      }

      return res.status(200).json({
        success: true,
        data: job
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin chi tiết công việc: ' + error.message
      });
    }
  },

  /**
   * 3. Phê duyệt tin tuyển dụng (Chuyển từ PENDING_APPROVAL -> PUBLISHED)
   */
  approveJob: async (req, res) => {
    try {
      const { jobId } = req.params;
      const { reviewNote } = req.body;
      const adminId = req.user._id; // Lấy ID của Admin/Manager đăng nhập từ middleware auth

      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng.' });
      }

      if (job.status !== JobStatus.PENDING_APPROVAL) {
        return res.status(400).json({ success: false, message: 'Chỉ có thể phê duyệt tin đang ở trạng thái chờ duyệt.' });
      }

      // Cập nhật trạng thái và các metadata liên quan
      job.status = JobStatus.PUBLISHED;
      job.publishedAt = new Date();
      job.reviewedAt = new Date();
      job.reviewedBy = adminId;
      job.reviewNote = reviewNote || 'Đạt yêu cầu hệ thống';
      
      // Xóa các lý do từ chối cũ nếu có trước đó
      job.rejectedReason = null;

      await job.save();

      // Hook: Bắn thông báo duyệt Job
      try {
        if (job.createdBy) {
          await NotificationService.create({
            receiverUserId: job.createdBy,
            typeCode: NotificationTypeCode.JOB_APPROVED,
            title: 'Tin tuyển dụng đã được duyệt',
            content: `Tin tuyển dụng "${job.title}" của bạn đã được phê duyệt và hiển thị trên hệ thống.`,
            metadata: { jobId: job._id }
          });
        }
      } catch (notiError) {
        console.error('Lỗi bắn thông báo duyệt Job:', notiError.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Phê duyệt tin tuyển dụng thành công và đã hiển thị lên hệ thống.',
        data: job
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi phê duyệt tin tuyển dụng: ' + error.message
      });
    }
  },

  /**
   * 4. Từ chối phê duyệt tin tuyển dụng (Chuyển từ PENDING_APPROVAL -> DRAFT)
   */
  rejectJob: async (req, res) => {
    try {
      const { jobId } = req.params;
      const { rejectedReason, reviewNote } = req.body;
      const adminId = req.user._id;

      if (!rejectedReason) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối.' });
      }

      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng.' });
      }

      if (job.status !== JobStatus.PENDING_APPROVAL) {
        return res.status(400).json({ success: false, message: 'Chỉ có thể từ chối tin đang ở trạng thái chờ duyệt.' });
      }

      // Trả về bản nháp để User có thể sửa và gửi lại
      job.status = JobStatus.DRAFT; 
      job.rejectedReason = rejectedReason;
      job.reviewNote = reviewNote || rejectedReason;
      job.reviewedAt = new Date();
      job.reviewedBy = adminId;

      await job.save();

      return res.status(200).json({
        success: true,
        message: 'Từ chối duyệt tin thành công. Tin tuyển dụng đã chuyển về dạng bản nháp.',
        data: job
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi từ chối tin tuyển dụng: ' + error.message
      });
    }
  },

  /**
   * 5. Ban / Khóa tin tuyển dụng (Áp dụng cho tin đã đăng nhưng vi phạm chính sách)
   * Chuyển trạng thái -> BANNED
   */
  banJob: async (req, res) => {
    try {
      const { jobId } = req.params;
      const { bannedReason } = req.body;
      const adminId = req.user._id;

      if (!bannedReason) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do khóa tin tuyển dụng.' });
      }

      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng.' });
      }

      if (job.status === JobStatus.BANNED) {
        return res.status(400).json({ success: false, message: 'Tin tuyển dụng này đã bị khóa từ trước.' });
      }

      // Khóa tin tuyển dụng
      job.status = JobStatus.BANNED;
      job.bannedReason = bannedReason;
      job.closedAt = new Date(); // Đồng thời đóng tin tuyển dụng không cho ứng tuyển
      job.reviewedAt = new Date();
      job.reviewedBy = adminId;

      await job.save();

      return res.status(200).json({
        success: true,
        message: 'Đã khóa tin tuyển dụng thành công do vi phạm.',
        data: job
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi khóa tin tuyển dụng: ' + error.message
      });
    }
  }
};

export default jobAdminController;