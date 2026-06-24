import mongoose from 'mongoose';
import { Cv, CvTemplate, CvSection } from '../models/index.js';
import { CvStatus } from '../enums/cvEnums.js';

export const createCv = async (req, res) => {
  try {
    const { templateId, title } = req.body;

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return res.status(400).json({ success: false, message: 'Mẫu thiết kế CV không hợp lệ' });
    }

    const template = await CvTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template không tồn tại' });
    }

    let sectionsState = [];
    if (template.layoutConfig?.sections && template.layoutConfig.sections.length > 0) {
      sectionsState = template.layoutConfig.sections.map((sec) => ({
        sectionCode: sec.sectionCode,
        order: sec.order,
        column: sec.column,
        position: sec.position || { x: 0, y: 0 },
        isVisible: sec.isVisible !== undefined ? sec.isVisible : true,
        items: sec.items || []
      }));
    } else {
      const defaultCodes = template.layoutConfig?.defaultSectionCodes || [];
      const sectionsData = await CvSection.find({ code: { $in: defaultCodes }, status: 'ACTIVE' });
      sectionsState = sectionsData.map((sec, index) => {
        let column = 'right';
        if (['PROFILE', 'CONTACT', 'SKILLS'].includes(sec.code)) {
          column = 'left';
        }
        if (template.layoutConfig?.columns === 1) {
          column = 'full';
        }

        return {
          sectionCode: sec.code,
          order: sec.defaultOrder || index + 1,
          column: column,
          position: { x: 0, y: 0 },
          isVisible: true,
          items: [] 
        };
      });
    }

    // Drafts do not automatically become main CVs
    const isMain = false;

    const newCv = await Cv.create({
      userId: req.user._id,
      title: title || `CV - ${template.name}`,
      templateId,
      templateCode: template.templateCode,
      previewImageUrl: template.previewImageUrl || template.thumbnailUrl,
      style: {
        fontId: template.layoutConfig?.defaultFontId || null,
        themeColorId: template.layoutConfig?.defaultColorId || null,
        backgroundType: 'NONE',
        fontSize: template.layoutConfig?.fontSize || 'medium',
        density: template.layoutConfig?.density || 'normal',
        titleStyle: template.layoutConfig?.titleStyle || 'underline',
        avatarShape: template.layoutConfig?.avatarShape || 'circle'
      },
      sections: sectionsState,
      isMain,
      status: CvStatus.DRAFT
    });

    res.status(201).json({ success: true, data: newCv });
  } catch (error) {
    console.error('Error in createCv:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const updateCv = async (req, res) => {
  try {
    const { title, sections, style, isMain, previewImageUrl, status, templateId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV không hợp lệ' });
    }

    const cv = await Cv.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    if (title) cv.title = title;
    if (sections) cv.sections = sections;
    if (style) cv.style = { ...cv.style, ...style };
    if (previewImageUrl !== undefined) cv.previewImageUrl = previewImageUrl;
    if (status) cv.status = status;
    
    if (templateId && templateId !== cv.templateId?.toString()) {
      const newTemplate = await CvTemplate.findById(templateId);
      if (newTemplate) {
        cv.templateId = newTemplate._id;
        cv.templateCode = newTemplate.templateCode;
        if (!previewImageUrl) {
          cv.previewImageUrl = newTemplate.previewImageUrl || newTemplate.thumbnailUrl;
        }
      }
    }

    if (isMain === true) {
      await Cv.updateMany({ userId: req.user._id, _id: { $ne: cv._id } }, { isMain: false });
      cv.isMain = true;
    } else if (isMain === false) {
      cv.isMain = false;
    }

    await cv.save();

    res.status(200).json({ success: true, data: cv });
  } catch (error) {
    console.error('Error in updateCv:', error);
    if (error.name === 'ValidationError') {
      const firstKey = Object.keys(error.errors || {})[0];
      const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
      return res.status(400).json({ success: false, message: firstMsg });
    }
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getCvById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV không hợp lệ' });
    }

    const cv = await Cv.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('templateId')
      .populate('style.fontId')
      .populate('style.themeColorId')
      .populate('style.backgroundId');

    if (!cv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    res.status(200).json({ success: true, data: cv });
  } catch (error) {
    console.error('Error in getCvById:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const getUserCvs = async (req, res) => {
  try {
      const cvs = await Cv.find({ userId: req.user._id, status: { $in: [CvStatus.ACTIVE, CvStatus.DRAFT] } })
        .populate('templateId', 'name thumbnailUrl previewImageUrl')
        .sort('-updatedAt');

    res.status(200).json({ success: true, data: cvs });
  } catch (error) {
    console.error('Error in getUserCvs:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

export const deleteCv = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã định danh CV không hợp lệ' });
    }

    const cv = await Cv.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!cv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    cv.status = CvStatus.DELETED;
    await cv.save();

    // Nếu CV bị xóa là CV chính, tự động đặt CV hoạt động gần nhất còn lại làm CV chính mới
    if (cv.isMain) {
      const anotherCv = await Cv.findOne({ userId: req.user._id, status: CvStatus.ACTIVE }).sort('-updatedAt');
      if (anotherCv) {
        anotherCv.isMain = true;
        await anotherCv.save();
      }
    }

    res.status(200).json({ success: true, message: 'CV đã được xóa' });
  } catch (error) {
    console.error('Error in deleteCv:', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};
