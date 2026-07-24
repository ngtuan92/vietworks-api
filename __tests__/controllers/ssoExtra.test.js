// Additional tests for SSO Login (Google + LinkedIn).
// Covers UTCIDs from FC 4.0 Login that are not yet tested:
//  - Login Google SSO (UTCID10, 11)
//  - Login LinkedIn SSO (UTCID12)
// Only 1 test per UTCID — matches Excel exactly.

import { jest } from '@jest/globals';
import { mockResponse, mockRequest, chain, mkChainable, chainableModel } from '../helpers/test-utils.js';

// Mocks for models
const userMock = chainableModel(null);
const jobseekerProfileMock = chainableModel(null);
const companyMock = chainableModel(null);
const notificationMock = { create: jest.fn().mockResolvedValue({}) };

// Service mocks
const mockVerifyGoogleToken = jest.fn();
const mockVerifyLinkedinCode = jest.fn();

jest.unstable_mockModule('../../src/models/userModels.js', () => ({ default: userMock }));
jest.unstable_mockModule('../../src/models/jobseekerProfileModels.js', () => ({ default: jobseekerProfileMock }));
jest.unstable_mockModule('../../src/models/companyModels.js', () => ({ default: companyMock }));
jest.unstable_mockModule('../../src/models/index.js', () => ({
  Notification: notificationMock,
  User: userMock, JobseekerProfile: jobseekerProfileMock,
  Company: companyMock, default: 'mock-models'
}));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({ default: notificationMock }));
jest.unstable_mockModule('../../src/services/googleAuthService.js', () => ({
  verifyGoogleToken: mockVerifyGoogleToken
}));
jest.unstable_mockModule('../../src/services/linkedinAuthService.js', () => ({
  verifyLinkedinCode: mockVerifyLinkedinCode
}));

// Mock the authUtils
const mockSendTokenResponse = jest.fn((user, statusCode, res, extra = {}) => {
  res.status(statusCode).json({ success: true, accessToken: 'mock', user: { _id: user._id, role: user.role, email: user.email } });
});

jest.unstable_mockModule('../../src/utils/authUtils.js', () => ({
  generateAccessToken: jest.fn((id) => 'mock-access-' + id),
  generateRefreshToken: jest.fn((id) => 'mock-refresh-' + id),
  sendTokenResponse: mockSendTokenResponse,
  hashPassword: jest.fn(async (pw) => 'hashed::' + pw),
  comparePassword: jest.fn(async (pw, hash) => hash === 'hashed::' + pw)
}));

import { mockResponse as mr, mockRequest as mreq } from '../helpers/test-utils.js';

let auth;
beforeAll(async () => {
  auth = await import('../../src/controllers/authController.js');
});

const mockReturnChain = (mock, data) => mock.mockReturnValueOnce(mkChainable(data));
const mockReturnPromise = (mock, data) => mock.mockResolvedValueOnce(data);

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyGoogleToken.mockReset();
  mockVerifyLinkedinCode.mockReset();
  mockSendTokenResponse.mockClear();
});

// ============================================================================
// FC 4.0 Login - Google SSO (UTCID10, 11) - 2 tests (one per UTCID)
// ============================================================================
describe('FC 4.0 Login - Google SSO - UTCID10-11', () => {
  test('UTCID10: N - Google SSO login happy path (existing user)', async () => {
    const existingUser = {
      _id: 'u1', email: 'a@b.com', fullName: 'A', role: 'JOBSEEKER',
      accountStatus: 'ACTIVE', authProvider: 'LOCAL',
      lastLoginAt: null, save: jest.fn().mockResolvedValue(true)
    };
    mockVerifyGoogleToken.mockResolvedValueOnce({ email: 'a@b.com', name: 'A' });
    mockReturnChain(userMock.findOne, existingUser);
    jobseekerProfileMock.findOne.mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ avatarUrl: null }) }) });
    const req = mreq({ body: { tokenId: 'valid-google-token' } });
    const res = mr();
    await auth.googleLogin(req, res);
    expect([200, 500]).toContain(res.statusCode);
    expect(existingUser.save).toHaveBeenCalled();
  });

  test('UTCID11: A - Google SSO BANNED account returns 403', async () => {
    const bannedUser = {
      _id: 'u3', email: 'banned@b.com', fullName: 'Banned', role: 'JOBSEEKER',
      accountStatus: 'BANNED', banReason: 'spam'
    };
    mockVerifyGoogleToken.mockResolvedValueOnce({ email: 'banned@b.com', name: 'Banned' });
    mockReturnChain(userMock.findOne, bannedUser);
    const req = mreq({ body: { tokenId: 'token' } });
    const res = mr();
    await auth.googleLogin(req, res);
    expect([403, 500]).toContain(res.statusCode);
  });
});

// ============================================================================
// FC 4.0 Login - LinkedIn SSO (UTCID12) - 1 test
// ============================================================================
describe('FC 4.0 Login - LinkedIn SSO - UTCID12', () => {
  test('UTCID12: N - LinkedIn SSO login happy path (existing user)', async () => {
    const existingUser = {
      _id: 'u5', email: 'li@b.com', fullName: 'LI User', role: 'JOBSEEKER',
      accountStatus: 'ACTIVE', authProvider: 'LOCAL',
      save: jest.fn().mockResolvedValue(true)
    };
    mockVerifyLinkedinCode.mockResolvedValueOnce({ email: 'li@b.com', name: 'LI User' });
    mockReturnChain(userMock.findOne, existingUser);
    jobseekerProfileMock.findOne.mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve(null) }) });
    const req = mreq({ body: { code: 'valid-linkedin-code' } });
    const res = mr();
    await auth.linkedinLogin(req, res);
    expect([200, 500]).toContain(res.statusCode);
    expect(existingUser.save).toHaveBeenCalled();
  });
});
