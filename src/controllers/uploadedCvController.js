import mongoose from 'mongoose';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { v2 as cloudinary } from 'cloudinary';
import { UploadedCv } from '../models/index.js';
import { CvStatus } from '../enums/cvEnums.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

export const uploadCv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file CV để tải lên' });
    }

    const userId = req.user._id;

    const existingUploadedCvsCount = await UploadedCv.countDocuments({
      userId,
      status: CvStatus.ACTIVE
    });

    if (existingUploadedCvsCount >= 5) {
      return res.status(400).json({ success: false, message: 'Bạn đã đạt giới hạn tải lên 5 file CV. Vui lòng xóa bớt file cũ để tải lên tệp mới.' });
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

    // userId variable is already defined above

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
    console.error('Error in uploadCv:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
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
    console.error('Error in getUserUploadedCvs:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getUploadedCvById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV tải lên không hợp lệ' });
    }

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
    console.error('Error in getUploadedCvById:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const updateUploadedCv = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV tải lên không hợp lệ' });
    }

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
    console.error('Error in updateUploadedCv:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getUploadedCvView = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV tải lên không hợp lệ' });
    }

    const uploadedCv = await UploadedCv.findOne({ _id: id, userId, status: CvStatus.ACTIVE });
    if (!uploadedCv) return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });

    const isImageType = uploadedCv.fileUrl.includes('/image/upload/');
    let pdfBuffer;

    if (isImageType) {
      // File image type bị CDN ACL chặn → dùng generate_archive (API auth, bypass ACL)
      const match = uploadedCv.fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (!match) throw new Error('Invalid file URL');
      const publicId = match[1].replace(/\.[^/.]+$/, '');

      const archiveUrl = cloudinary.utils.download_archive_url({
        public_ids: [publicId],
        resource_type: 'image',
        flatten_folders: true,
        type: 'upload',
      });

      const response = await axios.get(archiveUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const zip = new AdmZip(Buffer.from(response.data));
      const entries = zip.getEntries();
      pdfBuffer = zip.readFile(entries[0]);
    } else {
      // File raw type → public, fetch trực tiếp
      const response = await axios.get(uploadedCv.fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
      pdfBuffer = Buffer.from(response.data);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${uploadedCv.fileName || 'cv.pdf'}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('getUploadedCvView error:', error.message);
    res.status(500).json({ success: false, message: 'Không thể tải file để xem trước' });
  }
};

export const deleteUploadedCv = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV tải lên không hợp lệ' });
    }

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
    console.error('Error in deleteUploadedCv:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};