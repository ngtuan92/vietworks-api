// controllers/companyMasterDataController.js
import CompanyIndustry from '../models/companyIndustryModels.js';
import CompanySize from '../models/companySizeModels.js';
import { CommonStatus } from '../enums/masterDataEnums.js';

export const getCompanyIndustries = async (req, res) => {
  try {
    const industries = await CompanyIndustry.find({
      status: CommonStatus.ACTIVE
    })
      .select('name slug status')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: industries.length,
      data: industries
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};

export const getCompanySizes = async (req, res) => {
  try {
    const sizes = await CompanySize.find({
      status: CommonStatus.ACTIVE
    })
      .select('code name minEmployees maxEmployees status')
      .sort({ minEmployees: 1 });

    return res.status(200).json({
      success: true,
      count: sizes.length,
      data: sizes
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: 'Lỗi máy chủ'
    });
  }
};

export const createCompanyIndustry = async (req, res) => {
  try {
    const { name, slug } = req.body;
    const existing = await CompanyIndustry.findOne({ slug });
    if (existing) return res.status(400).json({ success: false, message: 'Slug này đã tồn tại!' });

    const newItem = await CompanyIndustry.create({ name, slug });
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const updateCompanyIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, status } = req.body;
    const updated = await CompanyIndustry.findByIdAndUpdate(id, { name, slug, status }, { new: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const deleteCompanyIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    await CompanyIndustry.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE });
    res.status(200).json({ success: true, message: 'Đã ẩn thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const createCompanySize = async (req, res) => {
  try {
    const { code, name, minEmployees, maxEmployees } = req.body;
    const existing = await CompanySize.findOne({ code });
    if (existing) return res.status(400).json({ success: false, message: 'Mã Code đã tồn tại!' });

    const newItem = await CompanySize.create({ code, name, minEmployees, maxEmployees });
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const updateCompanySize = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, minEmployees, maxEmployees, status } = req.body;
    const updated = await CompanySize.findByIdAndUpdate(id, { name, minEmployees, maxEmployees, status }, { new: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const deleteCompanySize = async (req, res) => {
  try {
    const { id } = req.params;
    await CompanySize.findByIdAndUpdate(id, { status: CommonStatus.INACTIVE });
    res.status(200).json({ success: true, message: 'Đã ẩn thành công.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};