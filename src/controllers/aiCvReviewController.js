import mongoose from 'mongoose';
import axios from 'axios';
import { AiCvReview, UploadedCv } from '../models/index.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import AiUsageQuota from '../models/aiUsageQuotaModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';
import {
  AiCvType,
  AiJdInputType,
  AiReviewStatus,
  AiFeature,
  AiQuotaPeriodType
} from '../enums/aiEnums.js';

// URL của FastAPI server từ .env hoặc mặc định
const AI_CV_API_URL = process.env.AI_CV_API_URL || 'http://localhost:8000';

export const createAiReview = async (req, res) => {
  try {
    const { target_position, uploadedCvId } = req.body;

    if (!target_position) {
      return res.status(400).json({ success: false, message: 'Vị trí công việc mong muốn là bắt buộc.' });
    }

    // -- BẮT ĐẦU KIỂM TRA QUOTA --
    const now = new Date();
    
    // 1. Kiểm tra gói Boost CV có AI Premium
    const activeAiPackages = await UserServicePackage.find({
      userId: req.user._id,
      status: UserServicePackageStatus.ACTIVE,
      expiredAt: { $gt: now }
    }).populate({ path: 'packageId', model: 'ServicePackage', select: 'benefits' });

    const isUnlimited = activeAiPackages.some(sub => 
      sub.packageSnapshot?.aiPremiumAccess === true || 
      sub.packageId?.benefits?.aiPremiumAccess === true
    );
    let todayQuota = null;

    // 2. Nếu không có gói, kiểm tra Quota hàng ngày (2 lượt/ngày)
    if (!isUnlimited) {
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      todayQuota = await AiUsageQuota.findOne({
        userId: req.user._id,
        feature: AiFeature.AI_CV_REVIEW,
        periodType: AiQuotaPeriodType.DAILY,
        periodKey: todayStr
      });

      if (!todayQuota) {
        todayQuota = await AiUsageQuota.create({
          userId: req.user._id,
          feature: AiFeature.AI_CV_REVIEW,
          periodType: AiQuotaPeriodType.DAILY,
          periodKey: todayStr,
          limitCount: 2,
          usedCount: 0,
          resetAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        });
      }

      if (todayQuota.usedCount >= todayQuota.limitCount) {
        return res.status(403).json({
          success: false,
          message: 'Bạn đã sử dụng hết 2 lượt AI miễn phí trong ngày. Vui lòng nâng cấp gói dịch vụ để sử dụng không giới hạn.'
        });
      }
    }
    // -- KẾT THÚC KIỂM TRA QUOTA --

    let pdfBuffer = null;
    let fileName = 'cv.pdf';

    // Trường hợp 1: Chọn CV đã tải lên trong hệ thống
    if (uploadedCvId) {
      if (!mongoose.Types.ObjectId.isValid(uploadedCvId)) {
        return res.status(400).json({ success: false, message: 'Mã CV đã tải lên không hợp lệ.' });
      }

      const uploadedCv = await UploadedCv.findOne({
        _id: uploadedCvId,
        userId: req.user._id,
        status: 'ACTIVE'
      });

      if (!uploadedCv) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy file CV đã tải lên của bạn.' });
      }

      // Tải file PDF từ Cloudinary về dạng Buffer
      try {
        const fileResponse = await axios.get(uploadedCv.fileUrl, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        pdfBuffer = Buffer.from(fileResponse.data);
        fileName = uploadedCv.fileName || 'cv.pdf';
      } catch (fetchError) {
        console.error('Lỗi khi tải file từ Cloudinary:', fetchError);
        return res.status(500).json({ success: false, message: 'Không thể tải file CV từ Cloudinary.' });
      }
    } 
    // Trường hợp 2: Tải lên trực tiếp từ máy qua Multer
    else if (req.file) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname || 'cv.pdf';
    } 
    // Trường hợp không có file nào được cung cấp
    else {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file PDF để đánh giá.' });
    }

    // Khởi tạo bản ghi AI CV Review trạng thái PENDING
    const aiReviewRecord = await AiCvReview.create({
      userId: req.user._id,
      cvType: AiCvType.UPLOADED_CV,
      uploadedCvId: uploadedCvId || null,
      jdInputType: AiJdInputType.TEXT,
      jdText: target_position,
      status: AiReviewStatus.PENDING,
      aiProvider: 'Gemini',
      aiModel: 'gemini-2.5-flash',
      score: 0
    });

    try {
      // Gửi request dạng multipart/form-data tới FastAPI
      const formData = new FormData();
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('file', pdfBlob, fileName);
      formData.append('target_position', target_position);

      console.log(`[Backend Proxy] Dang gui request phan tich CV sang FastAPI: ${AI_CV_API_URL}/api/analyze-cv`);
      
      const response = await axios.post(`${AI_CV_API_URL}/api/analyze-cv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000 // Tăng timeout lên 60 giây vì AI phân tích có thể lâu
      });

      const responseData = response.data;

      if (responseData.status === 'success' && responseData.data) {
        const result = responseData.data;
        
        aiReviewRecord.status = AiReviewStatus.COMPLETED;
        aiReviewRecord.score = result.evaluation?.job_fit_score_100 || 0;
        aiReviewRecord.rawResult = result;

        await aiReviewRecord.save();
        
        // Cập nhật quota nếu không phải bản Unlimited
        if (!isUnlimited && todayQuota) {
          todayQuota.usedCount += 1;
          await todayQuota.save();
        }

        return res.status(200).json({
          success: true,
          data: aiReviewRecord
        });
      } else {
        throw new Error('FastAPI trả về kết quả không thành công');
      }

    } catch (apiError) {
      console.error('Lỗi khi giao tiếp với FastAPI:', apiError.message);
      
      aiReviewRecord.status = AiReviewStatus.FAILED;
      aiReviewRecord.errorMessage = apiError.response?.data?.detail || apiError.message;
      await aiReviewRecord.save();
      
      return res.status(500).json({
        success: false,
        message: 'Lỗi trong quá trình chấm điểm CV bằng AI: ' + (apiError.response?.data?.detail || apiError.message),
        data: aiReviewRecord
      });
    }

  } catch (error) {
    console.error('Error in createAiReview:', error);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const reviews = await AiCvReview.find({ userId: req.user._id })
      .populate('uploadedCvId', 'title fileName fileSize fileUrl')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error in getUserReviews:', error);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống.' });
  }
};

export const getReviewById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã đánh giá không hợp lệ.' });
    }

    const review = await AiCvReview.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('uploadedCvId', 'title fileName fileSize fileUrl');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả đánh giá.' });
    }

    return res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error('Error in getReviewById:', error);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống.' });
  }
};
