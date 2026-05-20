import { Cv, CvTemplate, CvSection } from '../models/index.js';
import { CvStatus } from '../enums/cvEnums.js';

export const createCv = async (req, res) => {
  try {
    const { templateId, title } = req.body;

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

    const newCv = await Cv.create({
      userId: req.user._id,
      title: title || `CV - ${template.name}`,
      templateId,
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
      status: CvStatus.ACTIVE
    });

    res.status(201).json({ success: true, data: newCv });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCv = async (req, res) => {
  try {
    const { title, sections, style } = req.body;

    const cv = await Cv.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    if (title) cv.title = title;
    if (sections) cv.sections = sections;
    if (style) cv.style = { ...cv.style, ...style };

    await cv.save();

    res.status(200).json({ success: true, data: cv });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCvById = async (req, res) => {
  try {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserCvs = async (req, res) => {
  try {
    const cvs = await Cv.find({ userId: req.user._id, status: CvStatus.ACTIVE })
      .populate('templateId', 'name thumbnailUrl')
      .sort('-updatedAt');

    res.status(200).json({ success: true, data: cvs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCv = async (req, res) => {
  try {
    const cv = await Cv.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!cv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy CV' });
    }

    cv.status = CvStatus.DELETED;
    await cv.save();

    res.status(200).json({ success: true, message: 'CV đã được xóa' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
