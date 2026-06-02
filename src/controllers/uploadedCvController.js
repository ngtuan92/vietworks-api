import { UploadedCv } from '../models/index.js';
import { CvStatus } from '../enums/cvEnums.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

export const uploadCv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file CV để tải lên' });
    }

    const { title } = req.body;
    let fileName = req.file.originalname;
    if (fileName.includes('%')) {
      try {
        fileName = decodeURIComponent(fileName);
      } catch (e) {
        // Keep original if decode fails
      }
    }
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;

    const userId = req.user._id;

    const folder = `vietworks/uploaded-cvs/${userId}`;
    const result = await uploadBufferToCloudinary(req.file.buffer, folder, 'raw');

    const uploadedCv = await UploadedCv.create({
      userId,
      title: title || fileName.replace(/\.[^/.]+$/, ''),
      fileUrl: result.secure_url,
      fileName,
      fileType,
      fileSize,
      textExtractStatus: 'NOT_EXTRACTED',
      status: CvStatus.ACTIVE
    });

    res.status(201).json({ success: true, data: uploadedCv });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getUserUploadedCvs = async (req, res) => {
  try {
    const userId = req.user._id;

    const uploadedCvs = await UploadedCv.find({
      userId,
      status: CvStatus.ACTIVE
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: uploadedCvs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getUploadedCvById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const uploadedCv = await UploadedCv.findOne({
      _id: id,
      userId,
      status: CvStatus.ACTIVE
    });

    if (!uploadedCv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    res.status(200).json({ success: true, data: uploadedCv });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updateUploadedCv = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    const uploadedCv = await UploadedCv.findOne({
      _id: id,
      userId,
      status: CvStatus.ACTIVE
    });

    if (!uploadedCv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    if (title) {
      uploadedCv.title = title;
    }

    await uploadedCv.save();

    res.status(200).json({ success: true, data: uploadedCv });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const deleteUploadedCv = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const uploadedCv = await UploadedCv.findOne({
      _id: id,
      userId,
      status: CvStatus.ACTIVE
    });

    if (!uploadedCv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    const fileUrl = uploadedCv.fileUrl;
    const publicId = fileUrl.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');

    try {
      await deleteFromCloudinary(publicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete file from Cloudinary:', cloudinaryError);
    }

    uploadedCv.status = CvStatus.DELETED;
    await uploadedCv.save();

    res.status(200).json({ success: true, message: 'Xóa CV thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};