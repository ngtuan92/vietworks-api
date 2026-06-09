// src/services/masterData.service.js

class BaseMasterService {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    return await this.model.create(data);
  }

  async getAll(filter = {}, sort = { order: 1, createdAt: -1 }) {
    return await this.model.find(filter).sort(sort);
  }

  async getById(id) {
    return await this.model.findById(id);
  }

  async update(id, data) {
    return await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return await this.model.findByIdAndDelete(id);
  }
}

// Khởi tạo các service cụ thể từ các Model của bạn
import CareerGroup from '../models/careerGroup.model.js';
import Career from '../models/career.model.js';
import CareerPosition from '../models/careerPosition.model.js';
import CompanyIndustry from '../models/companyIndustry.model.js';
import CompanySize from '../models/companySize.model.js';
import ExperienceLevel from '../models/experienceLevel.model.js';
import JobLevel from '../models/jobLevel.model.js';

export const careerGroupService = new BaseMasterService(CareerGroup);
export const companyIndustryService = new BaseMasterService(CompanyIndustry);
export const companySizeService = new BaseMasterService(CompanySize);
export const experienceLevelService = new BaseMasterService(ExperienceLevel);

// Các service cần custom logic nâng cao (ví dụ: populate relationship hoặc cascade filter)
export const careerService = {
  ...new BaseMasterService(Career),
  async getAllWithGroup(filter = {}) {
    return await Career.find(filter).populate('careerGroupId', 'name code').sort({ order: 1 });
  }
};

export const careerPositionService = {
  ...new BaseMasterService(CareerPosition),
  async getAllWithDetails(filter = {}) {
    return await CareerPosition.find(filter)
      .populate('careerGroupId', 'name')
      .populate('careerId', 'name')
      .sort({ order: 1 });
  }
};

export const jobLevelService = {
  ...new BaseMasterService(JobLevel),
  async getAllWithGroup(filter = {}) {
    return await JobLevel.find(filter).populate('careerGroupId', 'name').sort({ levelOrder: 1 });
  }
};