import { CvTemplate, Cv, CareerGroup } from '../models/index.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { slugify } from '../utils/slugify.js';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

// @desc    Tạo mẫu CV mới
// @route   POST /api/admin/cv-templates
// @access  Private/Admin
export const createCvTemplate = async (req, res) => {
  try {
    const { name, code, careerGroupId, description, templateCode, layoutConfig, isPremium } = req.body;

    const slug = slugify(name);
    
    const existingTemplate = await CvTemplate.findOne({ $or: [{ code }, { slug }] });
    if (existingTemplate) {
      return res.status(400).json({ success: false, message: 'Template code hoặc tên đã tồn tại (slug bị trùng)' });
    }

    const newTemplate = await CvTemplate.create({
      name,
      code,
      slug,
      careerGroupId,
      description,
      templateCode,
      layoutConfig,
      isPremium: isPremium || false,
      status: CommonStatus.ACTIVE,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cập nhật mẫu CV
// @route   PUT /api/admin/cv-templates/:id
// @access  Private/Admin
export const updateCvTemplate = async (req, res) => {
  try {
    const { name, description, isPremium, status, layoutConfig, templateCode, careerGroupId } = req.body;
    
    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    // Kiểm tra xem template đã có CV nào sử dụng chưa
    const cvCount = await Cv.countDocuments({ templateId: template._id });
    
    // Nếu có người dùng rồi, KHÔNG cho sửa layoutConfig, templateCode
    let updateData = {
      name,
      description,
      isPremium,
      status,
      careerGroupId
    };

    if (name && name !== template.name) {
      updateData.slug = slugify(name);
    }

    if (cvCount === 0) {
      // Chưa ai dùng, cho phép sửa cấu trúc
      if (layoutConfig) updateData.layoutConfig = layoutConfig;
      if (templateCode) updateData.templateCode = templateCode;
    }

    const updatedTemplate = await CvTemplate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updatedTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bật/tắt trạng thái mẫu CV
// @route   PATCH /api/admin/cv-templates/:id/status
// @access  Private/Admin
export const toggleCvTemplateStatus = async (req, res) => {
  try {
    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    template.status = template.status === CommonStatus.ACTIVE ? CommonStatus.INACTIVE : CommonStatus.ACTIVE;
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Tải ảnh preview cho mẫu CV
// @route   POST /api/admin/cv-templates/:id/preview-image
// @access  Private/Admin
export const uploadPreviewImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh' });
    }

    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    // Upload to Cloudinary
    const result = await uploadBufferToCloudinary(req.file.buffer, 'vietworks/cv-templates');
    
    // Cloudinary returns both secure_url
    template.previewImageUrl = result.secure_url;
    template.thumbnailUrl = result.secure_url; // You could potentially apply a transformation here if you wanted a smaller thumbnail URL from cloudinary
    
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy danh sách mẫu CV (dành cho Admin)
// @route   GET /api/admin/cv-templates
// @access  Private/Admin
export const getAdminCvTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, careerGroupId, sort = '-createdAt' } = req.query;
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') query.status = status;
    if (careerGroupId && careerGroupId !== 'all') query.careerGroupId = careerGroupId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const templates = await CvTemplate.find(query)
      .populate('careerGroupId', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CvTemplate.countDocuments(query);

    // Tính toán số CV sử dụng cho mỗi template
    const templatesWithStats = await Promise.all(templates.map(async (tpl) => {
      const usersCount = await Cv.countDocuments({ templateId: tpl._id });
      return { ...tpl.toObject(), usersCount };
    }));

    res.status(200).json({
      success: true,
      data: templatesWithStats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy danh sách mẫu CV hoạt động (dành cho Jobseeker)
// @route   GET /api/cv-templates
// @access  Public or Private/Jobseeker
export const getActiveCvTemplates = async (req, res) => {
  try {
    const { careerGroupId } = req.query;
    let query = { status: CommonStatus.ACTIVE };
    
    if (careerGroupId && careerGroupId !== 'all') {
      query.careerGroupId = careerGroupId;
    }

    const templates = await CvTemplate.find(query)
      .populate('careerGroupId', 'name code')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy chi tiết và xem trước mẫu CV
// @route   GET /api/cv-templates/:id/preview
// @access  Public or Private/Jobseeker
export const getCvTemplatePreview = async (req, res) => {
  try {
    const template = await CvTemplate.findById(req.params.id)
      .populate('careerGroupId', 'name code')
      .populate('layoutConfig.defaultFontId')
      .populate('layoutConfig.defaultColorId');
      
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy danh sách nhóm ngành nghề
// @route   GET /api/career-groups
// @access  Public or Private
export const getCareerGroups = async (req, res) => {
  try {
    const groups = await CareerGroup.find({ status: CommonStatus.ACTIVE }).sort('order name');
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
