import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const isAllowedUploadFile = (file) => {
  const fileName = (file.originalname || '').toLowerCase();
  const isPdfByMime = file.mimetype === 'application/pdf';
  const isPdfByExtension = fileName.endsWith('.pdf');
  const isOctetStreamPdf = file.mimetype === 'application/octet-stream' && isPdfByExtension;

  return file.mimetype.startsWith('image/') || isPdfByMime || isPdfByExtension || isOctetStreamPdf;
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (isAllowedUploadFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên hình ảnh hoặc file PDF!'), false);
    }
  }
});

export const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for CV files
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên file PDF!'), false);
    }
  }
});

export const uploadBufferToCloudinary = (buffer, folder = 'vietworks/cv-templates', resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

export const deleteFromCloudinary = (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};

export const generateSignedUrl = (fileUrl) => {
  const resourceTypeMatch = fileUrl.match(/cloudinary\.com\/[^/]+\/([^/]+)\/upload\//);
  const resourceType = resourceTypeMatch ? resourceTypeMatch[1] : 'image';

  const uploadMatch = fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!uploadMatch) return fileUrl;

  // raw type giữ extension trong publicId, image type bỏ extension
  const publicId = resourceType === 'raw'
    ? uploadMatch[1]
    : uploadMatch[1].replace(/\.[^/.]+$/, '');

  const options = { resource_type: resourceType, type: 'upload', sign_url: true };
  if (resourceType !== 'raw') options.format = 'pdf';

  return cloudinary.url(publicId, options);
};
