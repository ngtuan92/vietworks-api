import mongoose from 'mongoose';
import { CvTemplate, Cv, CareerGroup } from '../models/index.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { slugify } from '../utils/slugify.js';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';
import User from '../models/userModels.js';
import { Notification } from '../models/index.js';

export const createCvTemplate = async (req, res) => {
  try {
    const { name, code, careerGroupId, description, templateCode, layoutConfig, isPremium } = req.body;

    if (careerGroupId && !mongoose.Types.ObjectId.isValid(careerGroupId)) {
      return res.status(400).json({ success: false, message: 'Nhóm ngành nghề không hợp lệ' });
    }

    const slug = slugify(name);
    const codeValue = code || slug;
    
    const existingTemplate = await CvTemplate.findOne({ $or: [{ code: codeValue }, { slug }] });
    if (existingTemplate) {
      return res.status(400).json({ success: false, message: 'Template code hoặc tên đã tồn tại (slug bị trùng)' });
    }

    const newTemplate = await CvTemplate.create({
      name,
      code: codeValue,
      slug,
      careerGroupId,
      description,
      templateCode,
      layoutConfig,
      isPremium: isPremium || false,
      thumbnailUrl: req.body.thumbnailUrl || 'placeholder',
      previewImageUrl: req.body.previewImageUrl || 'placeholder',
      status: CommonStatus.ACTIVE,
      createdBy: req.user?._id || '000000000000000000000001'
    });

    // Bắn Broadcast ngầm cho toàn bộ JOBSEEKER (Tái sử dụng logic của Admin Notification)
    try {
      const users = await User.find({ role: 'JOBSEEKER' }).select('_id').lean();
      if (users.length > 0) {
        const broadcastLog = await Notification.create({
          receiverUserId: req.user?._id || '000000000000000000000001',
          typeCode: NotificationTypeCode.SYSTEM_UPDATE,
          title: `[Lịch sử Broadcast] Ra mắt mẫu CV: ${name}`,
          content: 'Broadcast khi tạo mẫu CV mới',
          metadata: { isBroadcastLog: true, targetRole: 'JOBSEEKER', sentCount: users.length, actionUrl: '/admin/cv-templates' }
        });

        try {
          const { getIO } = await import('../sockets/chatSocket.js');
          getIO().to(broadcastLog.receiverUserId.toString()).emit('new_notification', broadcastLog.toObject());
        } catch (e) {}

        // Chạy ngầm, không block
        Promise.resolve().then(async () => {
          const batchSize = 100;
          for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            await Promise.all(batch.map(user => 
              NotificationService.create({
                receiverUserId: user._id,
                typeCode: NotificationTypeCode.NEW_CV_TEMPLATE,
                title: 'Mẫu CV mới đã ra mắt!',
                content: `Hệ thống vừa ra mắt mẫu CV mới: "${name}". Hãy thử ngay!`,
                metadata: { templateId: newTemplate._id, broadcastId: broadcastLog._id.toString(), actionUrl: `/cv-templates/gallery?templateId=${newTemplate._id}` }
              })
            ));
          }
        });
      }
    } catch (notiError) {
      console.error('Lỗi bắn Broadcast mẫu CV mới:', notiError.message);
    }

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    console.error('Error in createCvTemplate:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const updateCvTemplate = async (req, res) => {
  try {
    const { name, description, isPremium, status, layoutConfig, templateCode, careerGroupId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh mẫu CV không hợp lệ' });
    }

    if (careerGroupId && !mongoose.Types.ObjectId.isValid(careerGroupId)) {
      return res.status(400).json({ success: false, message: 'Nhóm ngành nghề không hợp lệ' });
    }

    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

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
    if (layoutConfig) updateData.layoutConfig = layoutConfig;
    if (templateCode) updateData.templateCode = templateCode;

    const updatedTemplate = await CvTemplate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updatedTemplate });
  } catch (error) {
    console.error('Error in updateCvTemplate:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const toggleCvTemplateStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh mẫu CV không hợp lệ' });
    }

    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    template.status = template.status === CommonStatus.ACTIVE ? CommonStatus.INACTIVE : CommonStatus.ACTIVE;
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error('Error in toggleCvTemplateStatus:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const uploadPreviewImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh mẫu CV không hợp lệ' });
    }

    const template = await CvTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, 'vietworks/cv-templates');
    
    template.previewImageUrl = result.secure_url;
    template.thumbnailUrl = result.secure_url;
    
    await template.save();

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

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

    const templatesWithStats = await Promise.all(templates.map(async (tpl) => {
      const uniqueUsers = await Cv.distinct('userId', { templateId: tpl._id });
      return { ...tpl.toObject(), usersCount: uniqueUsers.length };
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
    console.error('Error in getAdminCvTemplates:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

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
    console.error('Error in getActiveCvTemplates:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getCvTemplatePreview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh mẫu CV không hợp lệ' });
    }

    const template = await CvTemplate.findById(req.params.id)
      .populate('careerGroupId', 'name code')
      .populate('layoutConfig.defaultFontId')
      .populate('layoutConfig.defaultColorId');
      
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error('Error in getCvTemplatePreview:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getCareerGroups = async (req, res) => {
  try {
    const groups = await CareerGroup.find({ status: CommonStatus.ACTIVE }).sort('order name');
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error('Error in getCareerGroups:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const deleteCvTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh mẫu CV không hợp lệ' });
    }

    const template = await CvTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu CV' });
    }

    const usedCount = await Cv.countDocuments({ templateId: id });

    if (usedCount > 0) {
      if (template.status !== CommonStatus.INACTIVE) {
        template.status = CommonStatus.INACTIVE;
        await template.save();
      }

      return res.status(200).json({
        success: true,
        message: 'Mẫu CV đã được sử dụng nên được chuyển sang trạng thái ngừng hoạt động để bảo toàn dữ liệu lịch sử',
        data: template
      });
    }

    await CvTemplate.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Xóa mẫu CV thành công' });
  } catch (error) {
    console.error('Error in deleteCvTemplate:', error);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

