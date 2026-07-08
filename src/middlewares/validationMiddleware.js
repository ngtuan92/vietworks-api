// middlewares/validationMiddleware.js
import { body, validationResult } from 'express-validator';

export const validateCareerGroup = [
  body('name').notEmpty().withMessage('Tên nhóm nghề là bắt buộc')
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải từ 2-100 ký tự'),
  body('code').notEmpty().withMessage('Mã nhóm nghề là bắt buộc')
    .isLength({ min: 2, max: 20 }).withMessage('Mã phải từ 2-20 ký tự')
    .matches(/^[A-Z0-9_]+$/).withMessage('Mã chỉ chứa chữ hoa, số và dấu gạch dưới'),
  body('description').optional().isLength({ max: 500 }).withMessage('Mô tả tối đa 500 ký tự'),
  body('order').optional().isInt({ min: 0 }).withMessage('Thứ tự phải là số nguyên không âm'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];


export const validateCareer = [
  body('careerGroupId')
    .notEmpty()
    .withMessage('ID nhóm nghề là bắt buộc')
    .isMongoId()
    .withMessage('ID nhóm nghề không hợp lệ'),
    
  body('name')
    .notEmpty()
    .withMessage('Tên nghề là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự')
    .trim(),
    
  body('code')
    .notEmpty()
    .withMessage('Mã nghề là bắt buộc')
    .isLength({ min: 2, max: 20 })
    .withMessage('Mã phải từ 2-20 ký tự')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Mã chỉ chứa chữ hoa, số và dấu gạch dưới')
    .trim()
    .toUpperCase(),
    
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Mô tả tối đa 500 ký tự')
    .trim(),
    
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm')
    .toInt(),
    
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];



// middlewares/validationMiddleware.js (thêm vào file đã có)

export const validateCareerPosition = [
  body('careerGroupId')
    .notEmpty()
    .withMessage('ID nhóm nghề là bắt buộc')
    .isMongoId()
    .withMessage('ID nhóm nghề không hợp lệ'),
    
  body('careerId')
    .notEmpty()
    .withMessage('ID nghề là bắt buộc')
    .isMongoId()
    .withMessage('ID nghề không hợp lệ'),
    
  body('name')
    .notEmpty()
    .withMessage('Tên vị trí là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự')
    .trim(),
    
  body('code')
    .notEmpty()
    .withMessage('Mã vị trí là bắt buộc')
    .isLength({ min: 2, max: 20 })
    .withMessage('Mã phải từ 2-20 ký tự')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Mã chỉ chứa chữ hoa, số và dấu gạch dưới')
    .trim()
    .toUpperCase(),
    
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Mô tả tối đa 500 ký tự')
    .trim(),
    
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm')
    .toInt(),
    
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];


// middlewares/validationMiddleware.js (thêm vào file đã có)

export const validateJobLevel = [
  body('code')
    .notEmpty()
    .withMessage('Mã cấp bậc là bắt buộc')
    .isLength({ min: 2, max: 20 })
    .withMessage('Mã phải từ 2-20 ký tự')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Mã chỉ chứa chữ hoa, số và dấu gạch dưới')
    .trim()
    .toUpperCase(),
    
  body('name')
    .notEmpty()
    .withMessage('Tên cấp bậc là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự')
    .trim(),
    
  body('levelOrder')
    .notEmpty()
    .withMessage('Thứ tự cấp bậc là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('Thứ tự phải là số nguyên dương')
    .toInt(),
    
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];



// middlewares/validationMiddleware.js (thêm vào file đã có)

export const validateSkill = [
  body('name')
    .notEmpty()
    .withMessage('Tên kỹ năng là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự')
    .trim(),
    
  body('aliases')
    .optional()
    .isArray()
    .withMessage('Aliases phải là một mảng'),
    
  body('careerGroupIds')
    .optional()
    .isArray()
    .withMessage('careerGroupIds phải là một mảng')
    .custom((value) => {
      if (value && value.length > 0) {
        const validIds = value.every(id => mongoose.Types.ObjectId.isValid(id));
        if (!validIds) {
          throw new Error('Một số ID nhóm nghề không hợp lệ');
        }
      }
      return true;
    }),
    
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];