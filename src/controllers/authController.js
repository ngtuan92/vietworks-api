import User from '../models/userModels.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, sendTokenResponse, hashPassword, comparePassword } from '../utils/authUtils.js';
import { UserRole, AccountStatus, AuthProvider } from '../enums/userEnums.js';
import { Gender } from '../enums/masterDataEnums.js';
import Wallet from '../models/walletModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import Company from '../models/companyModels.js';
import EmployerProfile from '../models/employerProfileModels.js';
import { verifyGoogleToken } from '../services/googleAuthService.js';
import { verifyLinkedinCode } from '../services/linkedinAuthService.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/emailService.js';

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const isValidEmail = (email) => {
  if (!email) return false;
  return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/.test(email);
};

const isValidPassword = (password) => {
  if (typeof password !== 'string') return false;
  const normalized = password.trim();
  if (normalized.length < 8) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;
  if (!/\d/.test(normalized)) return false;
  return true;
};

const isValidPhone = (phone) => {
  if (phone == null) return true;
  if (typeof phone !== 'string') return false;
  const normalized = phone.trim();
  if (!normalized.length) return false;
  const digits = normalized.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^[+\d][\d\s-]+$/.test(normalized);
};

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

const badRequest = (res, message) => res.status(400).json({ success: false, message });
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

const handleMongoWriteError = (res, error) => {
  if (error?.code === 11000) {
    const key = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
    return badRequest(res, `Giá trị bị trùng cho ${key}`);
  }
  if (error?.name === 'ValidationError') {
    const firstKey = Object.keys(error.errors || {})[0];
    const firstMsg = firstKey ? error.errors[firstKey]?.message : 'Dữ liệu không hợp lệ';
    return badRequest(res, firstMsg || 'Dữ liệu không hợp lệ');
  }
  return null;
};

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));


export const registerJobseeker = async (req, res) => {
  let createdUserId = null;
  let createdWalletId = null;
  let createdJobseekerProfileId = null;

  try {
    const fullName = normalizeString(req.body?.fullName);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const phone = req.body?.phone;

    if (!fullName || !email || !password) {
      return badRequest(res, 'Thiếu thông tin bắt buộc: họ tên, email, mật khẩu');
    }

    if (!isValidEmail(email)) {
      return badRequest(res, 'Email không đúng định dạng');
    }

    if (!isValidPassword(password)) {
      return badRequest(res, 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 8 ký tự gồm chữ và số');
    }

    if (!isValidPhone(phone)) {
      return badRequest(res, 'Số điện thoại không hợp lệ');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return badRequest(res, 'Tài khoản đã tồn tại');
    }

    const user = await User.create({
      fullName,
      email,
      passwordHash: password,
      role: UserRole.JOBSEEKER,
      phone: phone ? phone.trim() : undefined,
      accountStatus: AccountStatus.ACTIVE,
      authProvider: AuthProvider.LOCAL
    });
    createdUserId = user._id;

    const wallet = await Wallet.create({ userId: user._id });
    createdWalletId = wallet._id;

    const jobseekerProfile = await JobseekerProfile.create({ userId: user._id });
    createdJobseekerProfileId = jobseekerProfile._id;

    return sendTokenResponse(user, 201, res);
  } catch (error) {
    const handled = handleMongoWriteError(res, error);
    if (handled) {
      return handled;
    }

    if (createdJobseekerProfileId) {
      await JobseekerProfile.findByIdAndDelete(createdJobseekerProfileId);
    }
    if (createdWalletId) {
      await Wallet.findByIdAndDelete(createdWalletId);
    }
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
    }

    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const registerEmployer = async (req, res) => {
  let createdUserId = null;
  let createdCompanyId = null;
  let createdWalletId = null;
  let createdEmployerProfileId = null;

  try {
    const fullName = normalizeString(req.body?.fullName);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const phone = normalizeString(req.body?.phone);
    const representativeName = normalizeString(req.body?.representativeName);
    const gender = req.body?.gender;
    const company = req.body?.company;

    if (!fullName || !email || !password || !phone || !representativeName || !gender || !company) {
      return badRequest(res, 'Thiếu thông tin bắt buộc để đăng ký nhà tuyển dụng');
    }

    if (!isValidEmail(email)) {
      return badRequest(res, 'Email không đúng định dạng');
    }

    if (!isValidPassword(password)) {
      return badRequest(res, 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 8 ký tự gồm chữ và số');
    }

    if (!isValidPhone(phone)) {
      return badRequest(res, 'Số điện thoại không hợp lệ');
    }

    if (!Object.values(Gender).includes(gender)) {
      return badRequest(res, 'Giới tính không hợp lệ');
    }

    const requiredCompanyFields = ['name', 'taxCode', 'industryId', 'sizeId', 'email', 'phone', 'description'];
    const missingCompanyField = requiredCompanyFields.find((field) => !company[field]);
    if (missingCompanyField) {
      return badRequest(res, `Thiếu thông tin công ty bắt buộc: ${missingCompanyField}`);
    }

    const companyName = normalizeString(company.name);
    const companyTaxCode = normalizeString(company.taxCode);
    const companyEmail = normalizeEmail(company.email);
    const companyPhone = normalizeString(company.phone);
    const companyDescription = normalizeString(company.description);
    const companyIndustryId = company.industryId;
    const companySizeId = company.sizeId;
    const companyWebsite = company.website ? String(company.website).trim() : null;

    if (!companyName) {
      return badRequest(res, 'Tên công ty là bắt buộc');
    }

    if (!companyTaxCode) {
      return badRequest(res, 'Mã số thuế công ty là bắt buộc');
    }

    if (!companyEmail || !isValidEmail(companyEmail)) {
      return badRequest(res, 'Email công ty không hợp lệ');
    }

    if (!companyPhone || !isValidPhone(companyPhone)) {
      return badRequest(res, 'Số điện thoại công ty không hợp lệ');
    }

    if (!companyDescription) {
      return badRequest(res, 'Mô tả công ty là bắt buộc');
    }

    if (!isValidObjectId(companyIndustryId)) {
      return badRequest(res, 'Ngành nghề công ty không hợp lệ');
    }

    if (!isValidObjectId(companySizeId)) {
      return badRequest(res, 'Quy mô công ty không hợp lệ');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return badRequest(res, 'Tài khoản đã tồn tại');
    }

    const taxCodeExists = await Company.findOne({ taxCode: companyTaxCode });
    if (taxCodeExists) {
      return badRequest(res, 'Mã số thuế công ty đã tồn tại');
    }

    const user = await User.create({
      fullName,
      email,
      passwordHash: password,
      role: UserRole.EMPLOYER,
      phone,
      accountStatus: AccountStatus.UNVERIFIED,
      authProvider: AuthProvider.LOCAL
    });
    createdUserId = user._id;

    const wallet = await Wallet.create({
      userId: user._id
    });
    createdWalletId = wallet._id;

    const newCompany = await Company.create({
      ownerUserId: user._id,
      name: companyName,
      taxCode: companyTaxCode,
      website: companyWebsite || null,
      industryId: companyIndustryId,
      sizeId: companySizeId,
      email: companyEmail,
      phone: companyPhone,
      avatarUrl: company.avatarUrl || null,
      coverUrl: company.coverUrl || null,
      description: companyDescription,
      locations: Array.isArray(company.locations) ? company.locations : [],
      businessLicenseFile: company.businessLicenseFile || null
    });
    createdCompanyId = newCompany._id;

    const employerProfile = await EmployerProfile.create({
      userId: user._id,
      companyId: newCompany._id,
      representativeName,
      gender,
      phone
    });
    createdEmployerProfileId = employerProfile._id;

    const otpCode = generateOtpCode();
    const otpCodeHash = await hashPassword(otpCode);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        'emailVerification.otpCodeHash': otpCodeHash,
        'emailVerification.otpExpiresAt': otpExpiresAt,
        'emailVerification.otpLastSentAt': new Date()
      }
    });

    await sendOtpEmail({ toEmail: user.email, fullName: user.fullName, otpCode });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký nhà tuyển dụng thành công. Mã OTP đã được gửi đến email để xác thực.',
      data: { email: user.email }
    });
  } catch (error) {
    const handled = handleMongoWriteError(res, error);
    if (handled) {
      return handled;
    }

    if (createdEmployerProfileId) {
      await EmployerProfile.findByIdAndDelete(createdEmployerProfileId);
    }
    if (createdCompanyId) {
      await Company.findByIdAndDelete(createdCompanyId);
    }
    if (createdWalletId) {
      await Wallet.findByIdAndDelete(createdWalletId);
    }
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
    }

    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const verifyEmployerOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeString(req.body?.otp);

    if (!email || !otp) {
      return badRequest(res, 'Thiếu thông tin bắt buộc: email và OTP');
    }

    const user = await User.findOne({ email, role: UserRole.EMPLOYER }).select('+emailVerification.otpCodeHash');
    if (!user) {
      return badRequest(res, 'Không tìm thấy tài khoản nhà tuyển dụng');
    }

    if (user.accountStatus !== AccountStatus.UNVERIFIED) {
      return badRequest(res, 'Tài khoản đã được xác thực hoặc trạng thái không hợp lệ');
    }

    const otpCodeHash = user.emailVerification?.otpCodeHash;
    const otpExpiresAt = user.emailVerification?.otpExpiresAt;

    if (!otpCodeHash || !otpExpiresAt) {
      return badRequest(res, 'Chưa yêu cầu mã OTP');
    }

    if (new Date(otpExpiresAt).getTime() < Date.now()) {
      return badRequest(res, 'Mã OTP đã hết hạn');
    }

    const isOtpValid = await comparePassword(otp, otpCodeHash);
    if (!isOtpValid) {
      return badRequest(res, 'Mã OTP không hợp lệ');
    }

    user.accountStatus = AccountStatus.ACTIVE;
    user.emailVerification = {
      otpCodeHash: null,
      otpExpiresAt: null,
      otpLastSentAt: user.emailVerification?.otpLastSentAt || null,
      verifiedAt: new Date()
    };
    await user.save();

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    const handled = handleMongoWriteError(res, error);
    if (handled) {
      return handled;
    }
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const resendEmployerOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return badRequest(res, 'Thiếu thông tin bắt buộc: email');
    }

    const user = await User.findOne({ email, role: UserRole.EMPLOYER });
    if (!user) {
      return badRequest(res, 'Không tìm thấy tài khoản nhà tuyển dụng');
    }

    if (user.accountStatus !== AccountStatus.UNVERIFIED) {
      return badRequest(res, 'Tài khoản đã được xác thực hoặc trạng thái không hợp lệ');
    }

    const lastSentAt = user.emailVerification?.otpLastSentAt;
    if (lastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 1000);
      if (elapsedSeconds < 60) {
        return res.status(429).json({
          success: false,
          message: `Vui lòng chờ ${60 - elapsedSeconds} giây trước khi yêu cầu OTP mới`
        });
      }
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = await hashPassword(otpCode);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerification = {
      otpCodeHash,
      otpExpiresAt,
      otpLastSentAt: new Date(),
      verifiedAt: null
    };
    await user.save();

    await sendOtpEmail({ toEmail: user.email, fullName: user.fullName, otpCode });

    return res.status(200).json({
      success: true,
      message: 'Gửi lại OTP thành công'
    });
  } catch (error) {
    const handled = handleMongoWriteError(res, error);
    if (handled) {
      return handled;
    }
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

const loginByRole = async (req, res, expectedRole = null) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;

    if (!email || !password) {
      return badRequest(res, 'Thiếu thông tin bắt buộc: email, mật khẩu');
    }

    const user = await User.findOne({ email }).select('+passwordHash');

    if (user && expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: 'Vai trò tài khoản không được phép đăng nhập tại endpoint này'
      });
    }

    if (user && isBlockedAccount(user)) {
      return blockedAccountResponse(res, user);
    }

    if (user && user.role === UserRole.EMPLOYER && user.accountStatus === AccountStatus.UNVERIFIED) {
      return res.status(403).json({
        success: false,
        message: 'Email nhà tuyển dụng chưa được xác thực. Vui lòng xác thực OTP trước.'
      });
    }

    if (user && (await user.matchPassword(password))) {
      user.lastLoginAt = Date.now();
      await user.save();

      sendTokenResponse(user, 200, res);
    } else {
      res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};



export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword, confirmPassword } = req.body;
    const passwordConfirmation = confirmNewPassword || confirmPassword;

    if (!currentPassword || !newPassword || !passwordConfirmation) {
      return badRequest(res, 'Mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu là bắt buộc');
    }

    if (newPassword !== passwordConfirmation) {
      return badRequest(res, 'Xác nhận mật khẩu không khớp');
    }

    if (!isValidPassword(newPassword)) {
      return badRequest(res, 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 8 ký tự gồm chữ và số');
    }

    if (currentPassword === newPassword) {
      return badRequest(res, 'Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const user = await User.findById(req.user._id).select('+passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (isBlockedAccount(user)) {
      return blockedAccountResponse(res, user);
    }

    if (user.authProvider !== AuthProvider.LOCAL || !user.passwordHash) {
      return res.status(400).json({ success: false, message: 'Tài khoản này không sử dụng mật khẩu nội bộ' });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    user.passwordHash = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return badRequest(res, 'Email là bắt buộc');
    }

    if (!isValidEmail(email)) {
      return badRequest(res, 'Email không đúng định dạng');
    }

    const user = await User.findOne({ email });
    const genericMessage = 'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi.';

    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    if (isBlockedAccount(user)) {
      return blockedAccountResponse(res, user);
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordReset = {
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    };
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const resetPath = user.role === UserRole.EMPLOYER ? '/employer/reset-password' : '/reset-password';
    const resetUrl = `${frontendUrl}${resetPath}?token=${resetToken}`;

    await sendPasswordResetEmail({
      toEmail: user.email,
      fullName: user.fullName,
      resetUrl
    });

    return res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = req.params?.token || req.body?.token;
    const password = req.body?.password;
    const confirmPassword = req.body?.confirmPassword;

    if (!token) {
      return badRequest(res, 'Token đặt lại mật khẩu là bắt buộc');
    }

    if (!password || !confirmPassword) {
      return badRequest(res, 'Thiếu thông tin bắt buộc: mật khẩu và xác nhận mật khẩu');
    }

    if (password !== confirmPassword) {
      return badRequest(res, 'Xác nhận mật khẩu không khớp');
    }

    if (!isValidPassword(password)) {
      return badRequest(res, 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 8 ký tự gồm chữ và số');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      'passwordReset.tokenHash': tokenHash,
      'passwordReset.expiresAt': { $gt: new Date() }
    }).select('+passwordReset.tokenHash');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
    }

    if (isBlockedAccount(user)) {
      return blockedAccountResponse(res, user);
    }

    user.passwordHash = password;
    user.passwordReset = {
      tokenHash: null,
      expiresAt: null
    };
    await user.save();

    return res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
export const login = async (req, res) => loginByRole(req, res, null);
export const loginJobseeker = async (req, res) => loginByRole(req, res, UserRole.JOBSEEKER);
export const loginEmployer = async (req, res) => loginByRole(req, res, UserRole.EMPLOYER);

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Không tìm thấy refresh token' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (isBlockedAccount(user)) {
      return blockedAccountResponse(res, user);
    }

    const newAccessToken = generateAccessToken(user._id);
    res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Refresh token không hợp lệ' });
  }
};

export const logout = (req, res) => {
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công'
  });
};

const googleLoginByRole = async (req, res, expectedRole = null) => {
  try {
    const { tokenId, role } = req.body;
    const targetRole = expectedRole || role || UserRole.JOBSEEKER;

    const googleUser = await verifyGoogleToken(tokenId);
    const { email, name } = googleUser;

    let user = await User.findOne({ email });

    if (!user) {
      if (targetRole === UserRole.EMPLOYER) {
        return badRequest(res, 'Đăng nhập mạng xã hội cho nhà tuyển dụng chỉ áp dụng với tài khoản đã tồn tại');
      }

      user = await User.create({
        fullName: name,
        email,
        role: targetRole,
        accountStatus: AccountStatus.ACTIVE,
        authProvider: AuthProvider.GOOGLE
      });
    } else {
      if (isBlockedAccount(user)) {
        return blockedAccountResponse(res, user);
      }

      if (targetRole && user.role !== targetRole) {
        return res.status(403).json({
          success: false,
          message: 'Vai trò tài khoản không được phép đăng nhập Google tại endpoint này'
        });
      }

      user.lastLoginAt = Date.now();
      await user.save();
    }

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Google Login Error:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' || 'Xác thực Google thất bại' });
  }
};

const linkedinLoginByRole = async (req, res, expectedRole = null) => {
  try {
    const { code, role } = req.body;
    const targetRole = expectedRole || role || UserRole.JOBSEEKER;

    const linkedinUser = await verifyLinkedinCode(code);
    const { email, name } = linkedinUser;

    let user = await User.findOne({ email });

    if (!user) {
      if (targetRole === UserRole.EMPLOYER) {
        return badRequest(res, 'Đăng nhập mạng xã hội cho nhà tuyển dụng chỉ áp dụng với tài khoản đã tồn tại');
      }

      user = await User.create({
        fullName: name,
        email,
        role: targetRole,
        accountStatus: AccountStatus.ACTIVE,
        authProvider: AuthProvider.LINKEDIN
      });
    } else {
      if (isBlockedAccount(user)) {
        return blockedAccountResponse(res, user);
      }

      if (targetRole && user.role !== targetRole) {
        return res.status(403).json({
          success: false,
          message: 'Vai trò tài khoản không được phép đăng nhập LinkedIn tại endpoint này'
        });
      }

      user.lastLoginAt = Date.now();
      await user.save();
    }

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('LinkedIn Login Error:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' || 'Xác thực LinkedIn thất bại' });
  }
};

export const googleLogin = async (req, res) => googleLoginByRole(req, res, null);
export const googleLoginJobseeker = async (req, res) => googleLoginByRole(req, res, UserRole.JOBSEEKER);
export const googleLoginEmployer = async (req, res) => googleLoginByRole(req, res, UserRole.EMPLOYER);
export const linkedinLogin = async (req, res) => linkedinLoginByRole(req, res, null);
export const linkedinLoginJobseeker = async (req, res) => linkedinLoginByRole(req, res, UserRole.JOBSEEKER);
export const linkedinLoginEmployer = async (req, res) => linkedinLoginByRole(req, res, UserRole.EMPLOYER);





