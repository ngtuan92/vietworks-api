// controllers/uploadController.js
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

export const uploadCompanyImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa tải lên file ảnh'
      });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'vietworks/company'
    );

    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên thành công',
      data: {
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Tải ảnh lên thất bại',
      error: 'Lỗi máy chủ'
    });
  }
};
