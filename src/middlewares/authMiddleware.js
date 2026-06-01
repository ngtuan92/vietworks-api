import jwt from 'jsonwebtoken';
import User from '../models/userModels.js';
import { AccountStatus } from '../enums/userEnums.js';

const isBlockedAccount = (user) => (
  user?.accountStatus === AccountStatus.BANNED || user?.accountStatus === 'LOCKED'
);

const blockedAccountResponse = (res, user) => res.status(403).json({
  success: false,
  code: 'ACCOUNT_BANNED',
  message: user?.banReason
    ? `Tài khoản của bạn đã bị khóa: ${user.banReason}`
    : 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
  banReason: user?.banReason || null,
  bannedAt: user?.bannedAt || null
});

export const checkAccountStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  if (isBlockedAccount(req.user)) {
    return blockedAccountResponse(res, req.user);
  }

  next();
};

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (isBlockedAccount(req.user)) {
      return blockedAccountResponse(res, req.user);
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token expired or invalid' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

