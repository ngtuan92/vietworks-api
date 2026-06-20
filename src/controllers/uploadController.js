// controllers/uploadController.js
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

const isPdfFile = (file) => {
  const fileName = (file?.originalname || '').toLowerCase();
  const mimeType = file?.mimetype || '';
  return mimeType === 'application/pdf' || mimeType === 'application/octet-stream' && fileName.endsWith('.pdf') || fileName.endsWith('.pdf');
};

export const uploadCompanyImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa tải lên file'
      });
    }

const resourceType = isPdfFile(req.file) ? 'image' : 'auto';    
const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'vietworks/company',
      resourceType
    );

    return res.status(200).json({
      success: true,
      message: 'Tải file lên thành công',
      data: {
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
  } catch (error) {
    console.error('Upload company file failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Tải file lên thất bại',
      error: error.message || 'Lỗi máy chủ'
    });
  }
};

export const uploadAvatarImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa tải lên file'
      });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'vietworks/avatars'
    );

    return res.status(200).json({
      success: true,
      message: 'Tải file lên thành công',
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
      message: 'Tải file lên thất bại',
      error: 'Lỗi máy chủ'
    });
  }
};
