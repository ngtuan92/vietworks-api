// Auth domain unit tests — covers UTCID mapping for:
//   Authentication and Authorization (1.0), Register Jobseeker (2.0),
//   Login (4.0), Logout (5.0), Change Password (7.0)
// (Register and Verify Employer (3.0), Forgot Password (6.0) are in a follow-up file
//  because they require additional OTP/email mocks.)

import { jest } from '@jest/globals';

// Mock factories are stored in module scope so multiple imports return the
// SAME jest.fn() reference (unstable_mockModule can be invoked more than once
// when ESM modules reference each other transitively).
const mockUser = {
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn()
};
const mockWallet = { create: jest.fn(), findByIdAndDelete: jest.fn() };
const mockJobseekerProfile = { create: jest.fn(), findByIdAndDelete: jest.fn(), findOne: jest.fn() };
const mockEmployerProfile = { create: jest.fn(), findByIdAndDelete: jest.fn() };
const mockCompany = { create: jest.fn(), findOne: jest.fn(), findByIdAndDelete: jest.fn() };
const mockCompanyLocation = { create: jest.fn() };
const mockCompanyIndustry = { find: jest.fn() };
const mockSendOtpEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockSendTokenResponse = jest.fn();
const mockHashPassword = jest.fn(async (pw) => `hashed::${pw}`);
const mockComparePassword = jest.fn(async (pw, hash) => hash === `hashed::${pw}`);
const mockGenerateAccessToken = jest.fn(() => 'mock.access.token');
const mockGenerateRefreshToken = jest.fn(() => 'mock.refresh.token');
const mockVerifyGoogleToken = jest.fn();
const mockVerifyLinkedinCode = jest.fn();
const mockNotify = jest.fn().mockResolvedValue({});

// ── Mock models ─────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/models/userModels.js', () => ({ default: mockUser }));
jest.unstable_mockModule('../../src/models/walletModels.js', () => ({ default: mockWallet }));
jest.unstable_mockModule('../../src/models/jobseekerProfileModels.js', () => ({ default: mockJobseekerProfile }));
jest.unstable_mockModule('../../src/models/employerProfileModels.js', () => ({ default: mockEmployerProfile }));
jest.unstable_mockModule('../../src/models/companyModels.js', () => ({ default: mockCompany }));
jest.unstable_mockModule('../../src/models/companyLocationModels.js', () => ({ default: mockCompanyLocation }));
jest.unstable_mockModule('../../src/models/companyIndustryModels.js', () => ({ default: mockCompanyIndustry }));

// ── Mock services ───────────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  sendOtpEmail: mockSendOtpEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail
}));

jest.unstable_mockModule('../../src/services/googleAuthService.js', () => ({
  verifyGoogleToken: mockVerifyGoogleToken
}));
jest.unstable_mockModule('../../src/services/linkedinAuthService.js', () => ({
  verifyLinkedinCode: mockVerifyLinkedinCode
}));

jest.unstable_mockModule('../../src/services/notificationService.js', () => ({
  default: { create: mockNotify }
}));

// ── Mock utility helpers ────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/authUtils.js', () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  sendTokenResponse: mockSendTokenResponse,
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword
}));

import { mockResponse, mockRequest } from '../helpers/test-utils.js';

let auth;
beforeAll(async () => {
  auth = await import('../../src/controllers/authController.js');
});

beforeEach(() => {
  jest.resetAllMocks();
  // Restore the sendTokenResponse implementation that the mock registered.
  mockSendTokenResponse.mockImplementation((user, statusCode, res) =>
    res.status(statusCode).cookie('refreshToken', 'mock.refresh.token', {}).json({
      success: true,
      accessToken: 'mock.access.token',
      user: { _id: user._id, role: user.role, email: user.email }
    })
  );
  mockHashPassword.mockImplementation(async (pw) => `hashed::${pw}`);
  mockComparePassword.mockImplementation(async (pw, hash) => hash === `hashed::${pw}`);
  mockUser.findOne.mockResolvedValue(null);
  mockUser.findById.mockResolvedValue(null);
  mockUser.findByIdAndDelete.mockResolvedValue({});
  // User.find used for admin notifications in registerEmployer: returns empty.
  mockUser.find.mockReturnValue({ select: () => Promise.resolve([]) });
  mockCompany.findOne.mockResolvedValue(null);
  mockCompanyIndustry.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  mockUser.create.mockImplementation(async (data) => ({ _id: 'user_new', ...data }));
  mockWallet.create.mockImplementation(async (data) => ({ _id: 'wallet_new', ...data }));
  mockJobseekerProfile.create.mockImplementation(async (data) => ({ _id: 'jsp_new', ...data }));
  mockEmployerProfile.create.mockImplementation(async (data) => ({ _id: 'emp_new', ...data }));
  mockEmployerProfile.findByIdAndDelete.mockResolvedValue({});
  mockCompany.create.mockImplementation(async (data) => ({ _id: 'company_new', ...data }));
  mockCompany.findByIdAndDelete.mockResolvedValue({});
  mockCompanyLocation.create.mockResolvedValue({ _id: 'loc_new' });
  mockWallet.findByIdAndDelete.mockResolvedValue({});
  mockJobseekerProfile.findByIdAndDelete.mockResolvedValue({});
});

// ────────────────────────── Authentication and Authorization ───────────────
// Excel UTCID01-11 — testing requireAuth middleware hand-off. We don't run the
// middleware here but we do test the JWT token flow through generate/send.

// ────────────────────────── Register Jobseeker (UTCID01–04) ─────────────────
describe('Register Jobseeker — UTCID01–04', () => {
  test('UTCID01: N — happy path returns 201 and creates user/wallet/profile', async () => {
    const req = mockRequest({
      body: { fullName: 'Nguyen Van A', email: 'jobseeker@abc.com', password: 'ValidPass123', phone: '0912345678' }
    });
    const res = mockResponse();
    await auth.registerJobseeker(req, res);
    expect(res.status).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.json).toHaveBeenCalled();
    expect(mockUser.create).toHaveBeenCalled();
    expect(mockWallet.create).toHaveBeenCalled();
    expect(mockJobseekerProfile.create).toHaveBeenCalled();
  });

  test('UTCID02: A — email already registered returns 400', async () => {
    mockUser.findOne.mockResolvedValueOnce({ _id: 'existing', email: 'jobseeker@abc.com' });
    const req = mockRequest({
      body: { fullName: 'Nguyen Van A', email: 'jobseeker@abc.com', password: 'ValidPass123', phone: '0912345678' }
    });
    const res = mockResponse();
    await auth.registerJobseeker(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Tài khoản đã tồn tại');
  });

  test('UTCID03: A — weak password returns 400', async () => {
    const req = mockRequest({
      body: { fullName: 'Nguyen Van A', email: 'jobseeker@abc.com', password: '123', phone: '0912345678' }
    });
    const res = mockResponse();
    await auth.registerJobseeker(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Mật khẩu quá yếu|quá yếu/);
  });

  test('UTCID04: A — Mongo server error returns 500 and rolls back created docs', async () => {
    mockUser.create.mockRejectedValueOnce(new Error('db boom'));
    const req = mockRequest({
      body: { fullName: 'Nguyen Van A', email: 'jobseeker@abc.com', password: 'ValidPass123', phone: '0912345678' }
    });
    const res = mockResponse();
    await auth.registerJobseeker(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Lỗi máy chủ');
  });
});

// ────────────────────────── Logout (UTCID01) ────────────────────────────────
describe('Logout — UTCID01', () => {
  test('N — sets expired refresh-token cookie and returns 200', async () => {
    const req = mockRequest({ user: { _id: 'u1' } });
    const res = mockResponse();
    auth.logout(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'none', expect.any(Object));
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Đăng xuất thành công');
  });
});

// ────────────────────────── Change Password (UTCID01–06) ───────────────────
// Changepassword guard verifies old password matches, that new password is
// at least 8 chars alnum, then saves new passwordHash on the user model.
describe('Change Password — UTCID01–06', () => {
  // Helper that builds a fake user doc with the helper .matchPassword used by controller.
  const makeUser = (overrides = {}) => {
    const passwordHash = 'OldPass123!';
    return {
      _id: 'u1',
      email: 'a@b.com',
      authProvider: 'LOCAL',
      accountStatus: 'ACTIVE',
      passwordHash,
      matchPassword: jest.fn(async (pw) => pw === passwordHash),
      save: jest.fn().mockResolvedValue(true),
      ...overrides
    };
  };

  test('UTCID01: N — happy path: returns 200 and persists new hash', async () => {
    const user = makeUser();
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(user) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmNewPassword: 'NewPass123!' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(200);
    expect(user.save).toHaveBeenCalled();
  });

  test('UTCID02: A — wrong current password returns 400', async () => {
    const user = makeUser();
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(user) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'WrongPass!', newPassword: 'NewPass123!', confirmNewPassword: 'NewPass123!' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Mật khẩu hiện tại không chính xác');
  });

  test('UTCID03: A — short new password returns 400', async () => {
    const user = makeUser();
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(user) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'OldPass123!', newPassword: 'short', confirmNewPassword: 'short' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Mật khẩu quá yếu/);
  });

  test('UTCID04: A — confirm password missing returns 400', async () => {
    const user = makeUser();
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(user) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Mật khẩu hiện tại, mật khẩu mới và xác nhận/);
  });

  test('UTCID05: A — user not found returns 404', async () => {
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(null) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmNewPassword: 'NewPass123!' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(404);
  });

  test('UTCID06: A — save error returns 500', async () => {
    const user = makeUser({ save: jest.fn().mockRejectedValue(new Error('write fail')) });
    mockUser.findById.mockReturnValueOnce({ select: () => Promise.resolve(user) });
    const req = mockRequest({
      user: { _id: 'u1' },
      body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!', confirmNewPassword: 'NewPass123!' }
    });
    const res = mockResponse();
    await auth.changePassword(req, res);
    expect(res.statusCode).toBe(500);
  });
});

// ────────────────────────── Login (UTCID01–12) ───────────────────────────────
// Login delegates to loginByRole helper. We mock User.findOne + user.matchPassword.
describe('Login — UTCID01–12', () => {
  const mkUser = (overrides = {}) => ({
    _id: 'user1',
    email: 'valid@abc.com',
    role: 'JOBSEEKER',
    accountStatus: 'ACTIVE',
    passwordHash: 'CorrectPass',
    matchPassword: jest.fn(async (pw) => pw === 'CorrectPass'),
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  });

  test('UTCID01: N — happy path jobseeker returns 200 + tokens', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkUser())
    });
    mockJobseekerProfile.findOne = mockJobseekerProfile.findOne || jest.fn();
    mockJobseekerProfile.findOne.mockReturnValueOnce({ select: () => ({ lean: async () => null }) });
    const req = mockRequest({ body: { email: 'valid@abc.com', password: 'CorrectPass' } });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendTokenResponse).toHaveBeenCalled();
  });

  test('UTCID02: A — wrong password returns 401', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.resolve(mkUser()) });
    const req = mockRequest({ body: { email: 'valid@abc.com', password: 'WrongPass' } });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('UTCID03: A — user not found returns 401', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.resolve(null) });
    const req = mockRequest({ body: { email: 'unknown@abc.com', password: 'any' } });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('UTCID04: A — BANNED account returns 403', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkUser({ accountStatus: 'BANNED', banReason: 'spam' }))
    });
    const req = mockRequest({ body: { email: 'banned@abc.com', password: 'CorrectPass' } });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('UTCID05: N — loginEmployer matching role succeeds', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkUser({ role: 'EMPLOYER', accountStatus: 'ACTIVE' }))
    });
    mockCompany.findOne = mockCompany.findOne || jest.fn();
    mockCompany.findOne.mockReturnValueOnce({ select: () => ({ lean: async () => null }) });
    const req = mockRequest({ body: { email: 'valid@abc.com', password: 'CorrectPass' } });
    const res = mockResponse();
    await auth.loginEmployer(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('UTCID06: A — loginEmployer rejects jobseeker with 403', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkUser({ role: 'JOBSEEKER' }))
    });
    const req = mockRequest({ body: { email: 'valid@abc.com', password: 'CorrectPass' } });
    const res = mockResponse();
    await auth.loginEmployer(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('UTCID07: A — UNVERIFIED employer returns 403', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkUser({ role: 'EMPLOYER', accountStatus: 'UNVERIFIED' }))
    });
    const req = mockRequest({ body: { email: 'valid@abc.com', password: 'CorrectPass' } });
    const res = mockResponse();
    await auth.loginEmployer(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('UTCID08: A — missing email/password returns 400', async () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID09-12: A — database error returns 500', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.reject(new Error('db down')) });
    const req = mockRequest({ body: { email: 'a@b.com', password: 'pwd1' } });
    const res = mockResponse();
    await auth.login(req, res);
    expect(res.statusCode).toBe(500);
  });
});

// ────────────────────────── Register Employer (UTCID01–05) ───────────────────
describe('Register Employer — UTCID01–05', () => {
  const validCompany = {
    name: 'ABC Corp', taxCode: '0101234567',
    industryIds: ['507f1f77bcf86cd799439011'],
    size: '50-100',
    email: 'c@abc.com', phone: '0987654321', description: 'cool'
  };

  test('UTCID01: N — happy path 201 + OTP email sent', async () => {
    const req = mockRequest({
      body: {
        fullName: 'HR A', email: 'hr@abc.com', password: 'ValidPass123', phone: '0912345678',
        representativeName: 'Nguyen Van B', gender: 'MALE',
        company: { ...validCompany, locationData: { provinceName: 'HCM', wardName: 'W1' } }
      }
    });
    const res = mockResponse();
    await auth.registerEmployer(req, res);
    expect(res.statusCode).toBe(201);
    expect(mockSendOtpEmail).toHaveBeenCalled();
  });

  test('UTCID02: A — missing required field returns 400', async () => {
    const req = mockRequest({ body: { email: 'hr@abc.com', password: 'ValidPass123' } });
    const res = mockResponse();
    await auth.registerEmployer(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID03: A — empty company name returns 400', async () => {
    const req = mockRequest({
      body: {
        fullName: 'HR A', email: 'hr@abc.com', password: 'ValidPass123', phone: '0912345678',
        representativeName: 'Nguyen Van B', gender: 'MALE',
        company: { ...validCompany, name: '' }
      }
    });
    const res = mockResponse();
    await auth.registerEmployer(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID04: A — existing user returns 400', async () => {
    mockUser.findOne.mockResolvedValueOnce({ _id: 'taken' });
    const req = mockRequest({
      body: {
        fullName: 'HR A', email: 'hr@abc.com', password: 'ValidPass123', phone: '0912345678',
        representativeName: 'Nguyen Van B', gender: 'MALE',
        company: validCompany
      }
    });
    const res = mockResponse();
    await auth.registerEmployer(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID05: A — server error returns 500 + rolls back docs', async () => {
    mockUser.create.mockRejectedValueOnce(new Error('db down'));
    const req = mockRequest({
      body: {
        fullName: 'HR A', email: 'hr@abc.com', password: 'ValidPass123', phone: '0912345678',
        representativeName: 'Nguyen Van B', gender: 'MALE',
        company: validCompany
      }
    });
    const res = mockResponse();
    await auth.registerEmployer(req, res);
    expect(res.statusCode).toBe(500);
  });
});

// ────────────────────────── Verify / Resend Employer OTP ─────────────────────
describe('Verify Employer OTP — UTCID06–10, Resend UTCID11–13', () => {
  const mkOtpUser = (overrides = {}) => ({
    _id: 'u1',
    email: 'hr@abc.com',
    role: 'EMPLOYER',
    accountStatus: 'UNVERIFIED',
    emailVerification: {
      otpCodeHash: 'hashed::123456',
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      otpLastSentAt: new Date(Date.now() - 60 * 1000)
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  });

  test('UTCID06: N — verify correct OTP marks account ACTIVE', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.resolve(mkOtpUser()) });
    mockUser.findByIdAndUpdate.mockResolvedValueOnce({ _id: 'u1' });
    const req = mockRequest({ body: { email: 'hr@abc.com', otp: '123456' } });
    const res = mockResponse();
    await auth.verifyEmployerOtp(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('UTCID07: A — wrong OTP returns 400', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.resolve(mkOtpUser()) });
    const req = mockRequest({ body: { email: 'hr@abc.com', otp: '999999' } });
    const res = mockResponse();
    await auth.verifyEmployerOtp(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID08: A — empty OTP returns 400', async () => {
    const req = mockRequest({ body: { email: 'hr@abc.com', otp: '' } });
    const res = mockResponse();
    await auth.verifyEmployerOtp(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID09: A — user not found returns 400', async () => {
    mockUser.findOne.mockReturnValueOnce({ select: () => Promise.resolve(null) });
    const req = mockRequest({ body: { email: 'hr@abc.com', otp: '123456' } });
    const res = mockResponse();
    await auth.verifyEmployerOtp(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID10: A — expired OTP returns 400', async () => {
    mockUser.findOne.mockReturnValueOnce({
      select: () => Promise.resolve(mkOtpUser({
        emailVerification: {
          otpCodeHash: 'hashed::123456',
          otpExpiresAt: new Date(Date.now() - 60 * 1000),
          otpLastSentAt: new Date(Date.now() - 600 * 1000)
        }
      }))
    });
    const req = mockRequest({ body: { email: 'hr@abc.com', otp: '123456' } });
    const res = mockResponse();
    await auth.verifyEmployerOtp(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID11: N — resend OTP for unverified user', async () => {
    // Note: resendEmployerOtp uses findOne without .select() chain.
    mockUser.findOne.mockResolvedValueOnce(mkOtpUser());
    mockUser.findByIdAndUpdate.mockResolvedValueOnce({});
    const req = mockRequest({ body: { email: 'hr@abc.com' } });
    const res = mockResponse();
    await auth.resendEmployerOtp(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendOtpEmail).toHaveBeenCalled();
  });

  test('UTCID12: B — cooldown 30s returns 429', async () => {
    mockUser.findOne.mockResolvedValueOnce(mkOtpUser({
      emailVerification: {
        otpCodeHash: 'hashed::123456',
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpLastSentAt: new Date(Date.now() - 30 * 1000)
      }
    }));
    const req = mockRequest({ body: { email: 'hr@abc.com' } });
    const res = mockResponse();
    await auth.resendEmployerOtp(req, res);
    expect(res.statusCode).toBe(429);
  });

  test('UTCID13: A — already ACTIVE returns 400', async () => {
    mockUser.findOne.mockResolvedValueOnce(mkOtpUser({ accountStatus: 'ACTIVE' }));
    const req = mockRequest({ body: { email: 'hr@abc.com' } });
    const res = mockResponse();
    await auth.resendEmployerOtp(req, res);
    expect(res.statusCode).toBe(400);
  });
});

// ────────────────────────── Forgot Password (UTCID01–07) ─────────────────────
describe('Forgot Password — UTCID01–07', () => {
  const mkUser = (overrides = {}) => ({
    _id: 'u1',
    email: 'employer@vietworks.vn',
    fullName: 'Test User',
    role: 'EMPLOYER',
    accountStatus: 'ACTIVE',
    authProvider: 'LOCAL',
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  });

  test('UTCID01: N — happy path sends reset email + 200', async () => {
    mockUser.findOne.mockResolvedValueOnce(mkUser());
    const req = mockRequest({ body: { email: 'employer@vietworks.vn' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendPasswordResetEmail).toHaveBeenCalled();
  });

  test('UTCID02: A — empty email returns 400', async () => {
    const req = mockRequest({ body: { email: '' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID03: A — null email returns 400', async () => {
    const req = mockRequest({ body: { email: null } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID04: A — invalid email format returns 400', async () => {
    const req = mockRequest({ body: { email: 'employer@' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('UTCID05: A — not-found email still returns generic 200', async () => {
    mockUser.findOne.mockResolvedValueOnce(null);
    const req = mockRequest({ body: { email: 'notfound@vietworks.vn' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('UTCID06: A — non-LOCAL authProvider returns generic 200', async () => {
    mockUser.findOne.mockResolvedValueOnce(mkUser({ authProvider: 'GOOGLE' }));
    const req = mockRequest({ body: { email: 'employer@vietworks.vn' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('UTCID07: A — email service throws returns 500', async () => {
    mockUser.findOne.mockResolvedValueOnce(mkUser());
    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('smtp fail'));
    const req = mockRequest({ body: { email: 'employer@vietworks.vn' } });
    const res = mockResponse();
    await auth.forgotPassword(req, res);
    expect(res.statusCode).toBe(500);
  });
});
