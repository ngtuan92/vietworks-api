import mongoose from 'mongoose';
import Job from '../models/jobModels.js';
import Career from '../models/careerModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import ExperienceLevel from '../models/experienceLevelModels.js';
import { JobStatus } from '../enums/jobEnums.js';
import { CommonStatus } from '../enums/masterDataEnums.js';

const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;

/**
 * @desc Lấy các lựa chọn cho công cụ tra cứu lương (nhóm nghề, nghề, vị trí, kinh nghiệm)
 * @route GET /tools/salary-lookup/options
 * @access Public
 */
export const getSalaryLookupOptions = async (req, res) => {
  try {
    const [careerGroups, careers, careerPositions, experienceLevels] = await Promise.all([
      CareerGroup.find({ status: CommonStatus.ACTIVE }).select('name slug').sort({ order: 1, name: 1 }).lean(),
      Career.find({ status: CommonStatus.ACTIVE }).select('name slug careerGroupId').sort({ name: 1 }).lean(),
      CareerPosition.find({ status: CommonStatus.ACTIVE }).select('name careerId careerGroupId').sort({ name: 1 }).lean(),
      ExperienceLevel.find({ status: CommonStatus.ACTIVE }).select('code name minYear maxYear').sort({ minYear: 1 }).lean()
    ]);

    return res.status(200).json({
      success: true,
      data: { careerGroups, careers, careerPositions, experienceLevels }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

/**
 * @desc Tra cứu lương trung bình theo vị trí/nghề, kinh nghiệm và địa điểm
 * @route GET /tools/salary-lookup
 * @access Public
 */
export const getSalaryLookup = async (req, res) => {
  try {
    const { careerGroupId, careerId, careerPositionId, experienceLevelId, location } = req.query;

    // Chỉ thống kê job đã hiển thị và có khoảng lương cụ thể (không tính "Thỏa thuận")
    const match = {
      status: JobStatus.PUBLISHED,
      'salary.type': 'RANGE',
      'salary.minMillion': { $ne: null }
    };

    const cgId = toObjectId(careerGroupId);
    if (cgId) match.careerGroupId = cgId;

    const cId = toObjectId(careerId);
    if (cId) match.careerId = cId;

    const cpId = toObjectId(careerPositionId);
    if (cpId) match.careerPositionId = cpId;

    const expId = toObjectId(experienceLevelId);
    if (expId) match.experienceLevelId = expId;

    if (location && location.trim()) {
      match['workLocations.provinceName'] = { $regex: location.trim(), $options: 'i' };
    }

    const result = await Job.aggregate([
      { $match: match },
      {
        $project: {
          minMillion: '$salary.minMillion',
          maxMillion: { $ifNull: ['$salary.maxMillion', '$salary.minMillion'] }
        }
      },
      {
        $project: {
          minMillion: 1,
          maxMillion: 1,
          midMillion: { $divide: [{ $add: ['$minMillion', '$maxMillion'] }, 2] }
        }
      },
      {
        $group: {
          _id: null,
          sampleSize: { $sum: 1 },
          averageMillion: { $avg: '$midMillion' },
          averageMinMillion: { $avg: '$minMillion' },
          averageMaxMillion: { $avg: '$maxMillion' },
          lowestMillion: { $min: '$minMillion' },
          highestMillion: { $max: '$maxMillion' }
        }
      }
    ]);

    const stats = result[0];
    const MIN_SAMPLE = 3;

    if (!stats || stats.sampleSize < MIN_SAMPLE) {
      return res.status(200).json({
        success: true,
        enoughData: false,
        message: 'Không đủ dữ liệu để thống kê lương cho lựa chọn này.',
        data: { sampleSize: stats?.sampleSize || 0 }
      });
    }

    const round1 = (n) => Math.round(n * 10) / 10;

    return res.status(200).json({
      success: true,
      enoughData: true,
      data: {
        sampleSize: stats.sampleSize,
        averageMillion: round1(stats.averageMillion),
        averageMinMillion: round1(stats.averageMinMillion),
        averageMaxMillion: round1(stats.averageMaxMillion),
        lowestMillion: round1(stats.lowestMillion),
        highestMillion: round1(stats.highestMillion),
        currency: 'VND',
        unit: 'million'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
