import mongoose from 'mongoose';
import Job from '../models/jobModels.js';
import Career from '../models/careerModels.js';
import CareerGroup from '../models/careerGroupModels.js';
import CareerPosition from '../models/careerPositionModels.js';
import ExperienceLevel from '../models/experienceLevelModels.js';
import { JobStatus } from '../enums/jobEnums.js';
import { CommonStatus } from '../enums/masterDataEnums.js';

import * as addressService from '../services/addressService.js';

const toObjectId = (v) =>
  v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;

/**
 * @desc Lấy các lựa chọn cho công cụ tra cứu lương (nhóm nghề, nghề, vị trí, kinh nghiệm)
 * @route GET /tools/salary-lookup/options
 * @access Public
 */
export const getSalaryLookupOptions = async (req, res) => {
  try {
    const [careerGroups, careers, careerPositions, experienceLevels, provincesData] = await Promise.all([
      CareerGroup.find({ status: CommonStatus.ACTIVE }).select('name slug').sort({ order: 1, name: 1 }).lean(),
      Career.find({ status: CommonStatus.ACTIVE }).select('name slug careerGroupId').sort({ name: 1 }).lean(),
      CareerPosition.find({ status: CommonStatus.ACTIVE }).select('name careerId careerGroupId').sort({ name: 1 }).lean(),
      ExperienceLevel.find({ status: CommonStatus.ACTIVE }).select('code name minYear maxYear').sort({ minYear: 1 }).lean(),
      addressService.getProvinces().catch(() => null)
    ]);

    const provinces = provincesData?.provinces || provincesData?.data?.provinces || [];

    return res.status(200).json({
      success: true,
      data: { careerGroups, careers, careerPositions, experienceLevels, provinces }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Các mốc chia khoảng cho biểu đồ phân bố lương (triệu VNĐ/tháng).
// Khoảng cuối là "trên 50tr" (không giới hạn trên).
const DISTRIBUTION_BOUNDARIES = [0, 5, 10, 15, 20, 25, 30, 40, 50];

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @desc Tra cứu lương trung bình theo vị trí/nghề, kinh nghiệm và địa điểm
 * @route GET /tools/salary-lookup
 * @access Public
 */
export const getSalaryLookup = async (req, res) => {
  try {
    const { careerGroupId, careerId, careerPositionId, experience, location, keyword } = req.query;

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

    if (experience && experience.trim()) {
      match.experience = experience.trim();
    }

    if (location && location.trim()) {
      match['workLocations.provinceName'] = location.trim();
    }

    if (keyword && keyword.trim()) {
      match.title = { $regex: escapeRegex(keyword.trim()), $options: 'i' };
    }

    const result = await Job.aggregate([
      { $match: match },
      {
        $project: {
          minMillion: '$salary.minMillion',
          maxMillion: { $ifNull: ['$salary.maxMillion', '$salary.minMillion'] },
          experience: 1
        }
      },
      {
        $project: {
          minMillion: 1,
          maxMillion: 1,
          experience: 1,
          midMillion: { $divide: [{ $add: ['$minMillion', '$maxMillion'] }, 2] }
        }
      },
      {
        $facet: {
          // Thống kê tổng quan
          overall: [
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
          ],
          // Biểu đồ phân bố: đếm số tin trong từng khoảng lương (theo điểm giữa)
          distribution: [
            {
              $bucket: {
                groupBy: '$midMillion',
                boundaries: DISTRIBUTION_BOUNDARIES,
                default: 'OVER',
                output: { count: { $sum: 1 } }
              }
            }
          ],
          // Lương trung bình theo từng mức kinh nghiệm
          byExperience: [
            {
              $group: {
                _id: '$experience',
                sampleSize: { $sum: 1 },
                averageMillion: { $avg: '$midMillion' },
                averageMinMillion: { $avg: '$minMillion' },
                averageMaxMillion: { $avg: '$maxMillion' }
              }
            },
            { $sort: { averageMillion: 1 } }
          ]
        }
      }
    ]);

    const facet = result[0] || {};
    const stats = facet.overall?.[0];
    const MIN_SAMPLE = 3;

    if (!stats || stats.sampleSize < MIN_SAMPLE) {
      return res.status(200).json({
        success: true,
        enoughData: false,
        message: 'Không đủ dữ liệu để thống kê lương cho lựa chọn này.',
        data: { sampleSize: stats?.sampleSize || 0 }
      });
    }

    // ─── Biểu đồ phân bố: map các bucket về nhãn dễ đọc, kèm khoảng còn thiếu (count 0) ───
    const bucketCountMap = new Map(
      (facet.distribution || []).map((b) => [b._id, b.count])
    );
    const distribution = [];
    for (let i = 0; i < DISTRIBUTION_BOUNDARIES.length - 1; i++) {
      const from = DISTRIBUTION_BOUNDARIES[i];
      const to = DISTRIBUTION_BOUNDARIES[i + 1];
      distribution.push({
        from,
        to,
        label: `${from}-${to}`,
        count: bucketCountMap.get(from) || 0
      });
    }
    const lastBoundary = DISTRIBUTION_BOUNDARIES[DISTRIBUTION_BOUNDARIES.length - 1];
    distribution.push({
      from: lastBoundary,
      to: null,
      label: `>${lastBoundary}`,
      count: bucketCountMap.get('OVER') || 0
    });

    // Khoảng lương phổ biến nhất (mode) = bucket có nhiều tin nhất
    const popularBucket = distribution.reduce(
      (best, cur) => (cur.count > best.count ? cur : best),
      distribution[0]
    );

    // ─── Lương theo kinh nghiệm ───
    const byExperience = (facet.byExperience || [])
      .filter((e) => e._id)
      .map((e) => {
        // Trích xuất số năm kinh nghiệm để sắp xếp (ví dụ: "3 năm" -> 3, "Chưa có kinh nghiệm" -> 0)
        let minYear = 0;
        const match = String(e._id).match(/\d+/);
        if (match) {
          minYear = parseInt(match[0], 10);
        }

        return {
          experience: e._id,
          name: e._id,
          minYear,
          sampleSize: e.sampleSize,
          averageMillion: round1(e.averageMillion),
          averageMinMillion: round1(e.averageMinMillion),
          averageMaxMillion: round1(e.averageMaxMillion)
        };
      })
      .sort((a, b) => (a.minYear ?? 0) - (b.minYear ?? 0));

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
        popularRange: {
          from: popularBucket.from,
          to: popularBucket.to,
          label: popularBucket.label,
          count: popularBucket.count
        },
        distribution,
        byExperience,
        currency: 'VND',
        unit: 'million'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
