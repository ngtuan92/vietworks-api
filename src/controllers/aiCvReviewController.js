import mongoose from 'mongoose';
import axios from 'axios';
import { AiCvReview, UploadedCv } from '../models/index.js';
import {
  AiCvType,
  AiJdInputType,
  AiReviewStatus
} from '../enums/aiEnums.js';
import { analyzeCvWithFormula } from '../services/aiCvReviewService.js';

export const createAiReview = async (req, res) => {
  let aiReviewRecord = null;

  try {
    const { target_position, uploadedCvId } = req.body;

    if (!target_position?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vị trí công việc mong muốn là bắt buộc.'
      });
    }

    let pdfBuffer = null;
    let fileName = 'cv.pdf';

    if (uploadedCvId) {
      if (!mongoose.Types.ObjectId.isValid(uploadedCvId)) {
        return res.status(400).json({
          success: false,
          message: 'Mã CV đã tải lên không hợp lệ.'
        });
      }

      const uploadedCv = await UploadedCv.findOne({
        _id: uploadedCvId,
        userId: req.user._id,
        status: 'ACTIVE'
      });

      if (!uploadedCv) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy file CV đã tải lên của bạn.'
        });
      }

      try {
        const fileResponse = await axios.get(uploadedCv.fileUrl, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        pdfBuffer = Buffer.from(fileResponse.data);
        fileName = uploadedCv.fileName || 'cv.pdf';
      } catch (fetchError) {
        console.error('Error fetching CV from Cloudinary:', fetchError);
        return res.status(500).json({
          success: false,
          message: 'Không thể tải file CV từ Cloudinary.'
        });
      }
    } else if (req.file) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname || 'cv.pdf';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp file PDF để đánh giá.'
      });
    }

    aiReviewRecord = await AiCvReview.create({
      userId: req.user._id,
      cvType: AiCvType.UPLOADED_CV,
      uploadedCvId: uploadedCvId || null,
      jdInputType: AiJdInputType.TEXT,
      jdText: target_position.trim(),
      status: AiReviewStatus.PENDING,
      aiProvider: 'Formula',
      aiModel: 'weighted-feature-scoring-v1',
      score: 0
    });

    const analysis = await analyzeCvWithFormula({
      pdfBuffer,
      fileName,
      targetPosition: target_position.trim()
    });

    aiReviewRecord.status = AiReviewStatus.COMPLETED;
    aiReviewRecord.score = analysis.score;
    aiReviewRecord.aiProvider = analysis.aiProvider;
    aiReviewRecord.aiModel = analysis.aiModel;
    aiReviewRecord.rawResult = analysis.rawResult;

    await aiReviewRecord.save();

    return res.status(200).json({
      success: true,
      data: aiReviewRecord
    });
  } catch (error) {
    console.error('Error in createAiReview:', error.response?.data || error.message || error);

    if (aiReviewRecord) {
      aiReviewRecord.status = AiReviewStatus.FAILED;
      aiReviewRecord.errorMessage = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message;
      await aiReviewRecord.save();

      return res.status(500).json({
        success: false,
        message: `Lỗi trong quá trình chấm điểm CV: ${aiReviewRecord.errorMessage}`,
        data: aiReviewRecord
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
    });
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
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống.'
    });
  }
};

export const getReviewById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã đánh giá không hợp lệ.'
      });
    }

    const review = await AiCvReview.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('uploadedCvId', 'title fileName fileSize fileUrl');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả đánh giá.'
      });
    }

    return res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error('Error in getReviewById:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống.'
    });
  }
};
