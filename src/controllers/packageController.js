import Package from '../models/servicePackageModels.js';

export const createPackage = async (req, res) => {
  try {
    const { name, description, price, currency, duration, jobPostsAllowed, featuredDays, cvAccessLimit, features, sortOrder } = req.body;

    const packageData = {
      name,
      description,
      price,
      currency: currency || 'VND',
      duration,
      jobPostsAllowed: jobPostsAllowed || 1,
      featuredDays: featuredDays || 0,
      cvAccessLimit: cvAccessLimit || 0,
      features: features || [],
      sortOrder: sortOrder || 0
    };

    const pkg = await Package.create(packageData);
    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, currency, duration, jobPostsAllowed, featuredDays, cvAccessLimit, features, isActive, sortOrder } = req.body;

    const pkg = await Package.findById(id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ' });
    }

    if (name !== undefined) pkg.name = name;
    if (description !== undefined) pkg.description = description;
    if (price !== undefined) pkg.price = price;
    if (currency !== undefined) pkg.currency = currency;
    if (duration !== undefined) pkg.duration = duration;
    if (jobPostsAllowed !== undefined) pkg.jobPostsAllowed = jobPostsAllowed;
    if (featuredDays !== undefined) pkg.featuredDays = featuredDays;
    if (cvAccessLimit !== undefined) pkg.cvAccessLimit = cvAccessLimit;
    if (features !== undefined) pkg.features = features;
    if (isActive !== undefined) pkg.isActive = isActive;
    if (sortOrder !== undefined) pkg.sortOrder = sortOrder;

    await pkg.save();
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updatePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const pkg = await Package.findById(id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ' });
    }

    pkg.isActive = isActive;
    await pkg.save();
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getPackages = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const packages = await Package.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
