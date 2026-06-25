// controllers/uploadController.js
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

const isPdfFile = (file) => {
  const fileName = (file?.originalname || '').toLowerCase();
  const mimeType = file?.mimetype || '';
  return mimeType === 'application/pdf' || mimeType === 'application/octet-stream' && fileName.endsWith('.pdf') || fileName.endsWith('.pdf');
};

const sanitizeCloudinaryFileName = (fileName = 'tep-dinh-kem') => {
  const normalized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'tep-dinh-kem';
};

const isImageFile = (file) => (file?.mimetype || '').startsWith('image/');

export const uploadCompanyImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa tải lên file'
      });
    }

const resourceType = isPdfFile(req.file) ? 'raw' : 'auto';    
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

export const uploadChatFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa tải lên file'
      });
    }

    const resourceType = isImageFile(req.file) ? 'image' : 'raw';
    const safeFileName = sanitizeCloudinaryFileName(req.file.originalname);
    const uploadOptions = resourceType === 'raw'
      ? { public_id: `${Date.now()}-${safeFileName}`, use_filename: false, unique_filename: false }
      : { use_filename: true, unique_filename: true };
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'vietworks/chat',
      resourceType,
      uploadOptions
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
      error: error.message || 'Lỗi máy chủ'
    });
  }
};

export const viewCloudinaryPdf = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'Thiếu URL' });
    
    const isImageType = url.includes('/image/upload/');
    let pdfBuffer;

    if (isImageType) {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (!match) throw new Error('Invalid file URL');
      const publicId = match[1].replace(/\.[^/.]+$/, '');

      const { v2: cloudinary } = await import('cloudinary');
      const AdmZip = (await import('adm-zip')).default;
      const axios = (await import('axios')).default;

      const archiveUrl = cloudinary.utils.download_archive_url({
        public_ids: [publicId],
        resource_type: 'image',
        flatten_folders: true,
        type: 'upload',
      });

      const response = await axios.get(archiveUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const zip = new AdmZip(Buffer.from(response.data));
      const entries = zip.getEntries();
      if (!entries || entries.length === 0) throw new Error('Empty archive');
      pdfBuffer = zip.readFile(entries[0]);
    } else {
      const axios = (await import('axios')).default;
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      pdfBuffer = Buffer.from(response.data);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('viewCloudinaryPdf error:', error.message);
    res.status(500).json({ success: false, message: 'Không thể tải file để xem trước' });
  }
};

