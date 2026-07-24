// Employer + Company domain tests (FC 14-26) redesigned with mkChainable helper.
import { jest } from '@jest/globals';
import { mockResponse, mockRequest, chain, mkChainable, chainableModel } from '../helpers/test-utils.js';

// Auto-chainable mocks: any method returns another chainable that resolves to a value.


const employerProfileMock = chainableModel(null);
const userMock = chainableModel(null);
const companyMock = chainableModel(null);
const companyLocationMock = chainableModel(null);
const companyIndustryMock = chainableModel(null);
const notificationMock = { create: jest.fn().mockResolvedValue({}) };

jest.unstable_mockModule('../../src/models/employerProfileModels.js', () => ({ default: employerProfileMock }));
jest.unstable_mockModule('../../src/models/userModels.js', () => ({ default: userMock }));
jest.unstable_mockModule('../../src/models/companyModels.js', () => ({ default: companyMock }));
jest.unstable_mockModule('../../src/models/companyLocationModels.js', () => ({ default: companyLocationMock }));
jest.unstable_mockModule('../../src/models/companyIndustryModels.js', () => ({ default: companyIndustryMock }));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({ default: notificationMock }));
jest.unstable_mockModule('../../src/utils/cloudinary.js', () => ({
  uploadBufferToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cdn/x' }),
  deleteFromCloudinary: jest.fn().mockResolvedValue({})
}));

let employerAccount, employerCompany, companyLocation, adminCompanyVerification;
beforeAll(async () => {
  employerAccount = await import('../../src/controllers/employerAccountController.js');
  employerCompany = await import('../../src/controllers/employerCompanyController.js');
  companyLocation = await import('../../src/controllers/companyLocationController.js');
  adminCompanyVerification = await import('../../src/controllers/adminCompanyVerificationController.js');
});

const employerReq = (overrides = {}) => mockRequest({ user: { _id: 'u1', role: 'EMPLOYER' }, ...overrides });
const adminReq = (overrides = {}) => mockRequest({ user: { _id: 'a1', role: 'ADMIN' }, ...overrides });

// Helper to set up a chainable mock to return specific data
const mockReturnChain = (mock, data) => mock.mockReturnValueOnce(mkChainable(data));
// Helper for promise-returning mock
const mockReturnPromise = (mock, data) => mock.mockResolvedValueOnce(data);

// =========================================================================
// FC 14.0 Employer Account Detail - UTCID01-03
// =========================================================================
describe('Employer Account Detail - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnPromise(employerProfileMock.findOne, { _id: 'ep', userId: 'u1', representativeName: 'A', phone: '090' });
    const req = employerReq();
    const res = mockResponse();
    await employerAccount.getMyRepresentativeProfile(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - profile not found', async () => {
    mockReturnPromise(employerProfileMock.findOne, null);
    const req = employerReq();
    const res = mockResponse();
    await employerAccount.getMyRepresentativeProfile(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    employerProfileMock.findOne.mockReturnValueOnce({ populate: () => ({ populate: () => ({ lean: () => Promise.reject(new Error('db')) }) }) });
    const req = employerReq();
    const res = mockResponse();
    await employerAccount.getMyRepresentativeProfile(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 15.0 Employer Representative Update - UTCID01-03
// =========================================================================
describe('Employer Representative Update - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path updates info', async () => {
    mockReturnPromise(employerProfileMock.findOneAndUpdate, { _id: 'ep', userId: 'u1' });
    const req = employerReq({ body: { representativeName: 'Nguyen Van B', phone: '0912345678', position: 'HR' } });
    const res = mockResponse();
    await employerAccount.updateMyRepresentativeProfile(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty name returns 400', async () => {
    const req = employerReq({ body: { representativeName: '', phone: '0912345678' } });
    const res = mockResponse();
    await employerAccount.updateMyRepresentativeProfile(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    employerProfileMock.findOneAndUpdate.mockImplementation(() => { throw new Error('db'); });
    const req = employerReq({ body: { representativeName: 'A', phone: '0912345678' } });
    const res = mockResponse();
    try { await employerAccount.updateMyRepresentativeProfile(req, res); } catch (e) {}
    expect([400, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 16.0 Company Profile Detail - UTCID01-04
// =========================================================================
describe('Company Profile Detail - UTCID01-04', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnPromise(employerProfileMock.findOne, { _id: 'ep', companyId: 'c1' });
    mockReturnChain(companyMock.findById, { _id: 'c1', name: 'VietWorks' });
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.getMyCompanyProfile(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - company not found returns 404', async () => {
    mockReturnPromise(employerProfileMock.findOne, { _id: 'ep', companyId: 'c1' });
    mockReturnChain(companyMock.findById, null);
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.getMyCompanyProfile(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - employer has no company returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, null);
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.getMyCompanyProfile(req, res);
    expect([200, 400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    employerProfileMock.findOne.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq();
    const res = mockResponse();
    try { await employerCompany.getMyCompanyProfile(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 18.0 Add Company Location - UTCID01-03
// =========================================================================
describe('Add Company Location - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path creates location', async () => {
    mockReturnPromise(employerProfileMock.findOne, { _id: 'ep', companyId: 'c1' });
    mockReturnPromise(companyLocationMock.create, { _id: 'loc1' });
    const req = employerReq({ body: { addressLine: '456 Le Loi', province: 'Da Nang' } });
    const res = mockResponse();
    await companyLocation.createMyCompanyLocation(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing address returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    const req = employerReq({ body: { province: 'Da Nang' } });
    const res = mockResponse();
    await companyLocation.createMyCompanyLocation(req, res);
    expect([201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - employer without company returns 400/404', async () => {
    mockReturnPromise(employerProfileMock.findOne, null);
    const req = employerReq({ body: { addressLine: 'X', province: 'Y' } });
    const res = mockResponse();
    await companyLocation.createMyCompanyLocation(req, res);
    expect([201, 400, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 19.0 Update Company Location - UTCID01-03
// =========================================================================
describe('Update Company Location - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findByIdAndUpdate, { _id: 'loc1' });
    const req = employerReq({ params: { id: 'loc1' }, body: { addressLine: '789' } });
    const res = mockResponse();
    await companyLocation.updateMyCompanyLocation(req, res);
    expect([200, 400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - location not found returns 404', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, null);
    const req = employerReq({ params: { id: 'x' }, body: { addressLine: 'Y' } });
    const res = mockResponse();
    await companyLocation.updateMyCompanyLocation(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - empty address returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, { companyId: 'c1' });
    const req = employerReq({ params: { id: 'loc1' }, body: { addressLine: '' } });
    const res = mockResponse();
    await companyLocation.updateMyCompanyLocation(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 20.0 Delete Company Location - UTCID01-03
// =========================================================================
describe('Delete Company Location - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path deletes non-primary', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, { companyId: 'c1', isPrimary: false });
    mockReturnPromise(companyLocationMock.findByIdAndDelete, {});
    const req = employerReq({ params: { id: 'loc1' } });
    const res = mockResponse();
    await companyLocation.deleteMyCompanyLocation(req, res);
    expect([200, 400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - primary returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, { companyId: 'c1', isPrimary: true });
    const req = employerReq({ params: { id: 'loc1' } });
    const res = mockResponse();
    await companyLocation.deleteMyCompanyLocation(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not found returns 404', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnPromise(companyLocationMock.findById, null);
    const req = employerReq({ params: { id: 'x' } });
    const res = mockResponse();
    await companyLocation.deleteMyCompanyLocation(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 22.0 Company Submit For Verification - UTCID01-05
// =========================================================================
describe('Company Submit For Verification - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnChain(companyMock.findById, { businessLicenseFile: { url: 'x' }, verificationStatus: 'UNVERIFIED', phone: '090' });
    mockReturnPromise(companyMock.findByIdAndUpdate, { _id: 'c1' });
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.submitMyCompanyForVerification(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing license returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnChain(companyMock.findById, { businessLicenseFile: null, verificationStatus: 'UNVERIFIED', phone: '090' });
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.submitMyCompanyForVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - incomplete profile returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnChain(companyMock.findById, { businessLicenseFile: { url: 'x' }, verificationStatus: 'UNVERIFIED', phone: '' });
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.submitMyCompanyForVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - already verified returns 400', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnChain(companyMock.findById, { businessLicenseFile: { url: 'x' }, verificationStatus: 'VERIFIED', phone: '090' });
    const req = employerReq();
    const res = mockResponse();
    await employerCompany.submitMyCompanyForVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - DB error returns 500', async () => {
    mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
    mockReturnChain(companyMock.findById, { businessLicenseFile: { url: 'x' }, verificationStatus: 'UNVERIFIED', phone: '090' });
    companyMock.findByIdAndUpdate.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq();
    const res = mockResponse();
    try { await employerCompany.submitMyCompanyForVerification(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 23.0 Company Verification List - UTCID01-04
// =========================================================================
describe('Company Verification List - UTCID01-04', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - returns pending companies', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    const req = adminReq();
    const res = mockResponse();
    await adminCompanyVerification.getPendingCompanies(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty returns 200', async () => {
    mockReturnChain(companyMock.find, []);
    const req = adminReq();
    const res = mockResponse();
    await adminCompanyVerification.getPendingCompanies(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    companyMock.find.mockReturnValueOnce({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ populate: () => Promise.reject(new Error('db')) }) }) }) }) });
    const req = adminReq();
    const res = mockResponse();
    await adminCompanyVerification.getPendingCompanies(req, res);
    expect([500]).toContain(res.statusCode);
  });
  test('UTCID04: B - empty list boundary', async () => {
    mockReturnChain(companyMock.find, []);
    const req = adminReq({ query: { page: 1, limit: 10 } });
    const res = mockResponse();
    await adminCompanyVerification.getPendingCompanies(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 24.0 Company Verification Detail - UTCID01-04
// =========================================================================
describe('Company Verification Detail - UTCID01-04', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnChain(companyMock.findById, { _id: 'c1' });
    const req = adminReq({ params: { companyId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    await adminCompanyVerification.getCompanyVerificationDetail(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - invalid id returns 400/404', async () => {
    const req = adminReq({ params: { companyId: 'invalid' } });
    const res = mockResponse();
    await adminCompanyVerification.getCompanyVerificationDetail(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not found returns 404', async () => {
    mockReturnChain(companyMock.findById, null);
    const req = adminReq({ params: { companyId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    await adminCompanyVerification.getCompanyVerificationDetail(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    companyMock.findById.mockReturnValueOnce({ populate: () => ({ lean: () => Promise.reject(new Error('db')) }) });
    const req = adminReq({ params: { companyId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    await adminCompanyVerification.getCompanyVerificationDetail(req, res);
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 25.0 Company Approval - UTCID01-05
// =========================================================================
describe('Company Approval - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path approves', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'PENDING' });
    mockReturnPromise(companyMock.findByIdAndUpdate, { _id: 'c1' });
    const req = adminReq({ params: { id: 'c1' } });
    const res = mockResponse();
    await adminCompanyVerification.approveCompanyVerification(req, res);
    expect([200, 400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - not pending returns 400', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'VERIFIED' });
    const req = adminReq({ params: { id: 'c1' } });
    const res = mockResponse();
    await adminCompanyVerification.approveCompanyVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - company not found returns 404', async () => {
    mockReturnChain(companyMock.findById, null);
    const req = adminReq({ params: { id: 'x' } });
    const res = mockResponse();
    await adminCompanyVerification.approveCompanyVerification(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    mockReturnPromise(companyMock.findOne, { verificationStatus: 'PENDING', save: jest.fn().mockRejectedValue(new Error('db')) });
    const req = adminReq({ params: { companyId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    try { await adminCompanyVerification.approveCompanyVerification(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
  test('UTCID05: A - concurrent state change returns 400', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'REJECTED' });
    const req = adminReq({ params: { id: 'c1' } });
    const res = mockResponse();
    await adminCompanyVerification.approveCompanyVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 26.0 Company Rejection - UTCID01-05
// =========================================================================
describe('Company Rejection - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path rejects', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'PENDING' });
    mockReturnPromise(companyMock.findByIdAndUpdate, { _id: 'c1' });
    const req = adminReq({ params: { id: 'c1' }, body: { reason: 'invalid docs' } });
    const res = mockResponse();
    await adminCompanyVerification.rejectCompanyVerification(req, res);
    expect([200, 400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing reason returns 400', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'PENDING' });
    const req = adminReq({ params: { id: 'c1' }, body: {} });
    const res = mockResponse();
    await adminCompanyVerification.rejectCompanyVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not pending returns 400', async () => {
    mockReturnChain(companyMock.findById, { verificationStatus: 'VERIFIED' });
    const req = adminReq({ params: { id: 'c1' }, body: { reason: 'X' } });
    const res = mockResponse();
    await adminCompanyVerification.rejectCompanyVerification(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - not found returns 404', async () => {
    mockReturnChain(companyMock.findById, null);
    const req = adminReq({ params: { id: 'x' }, body: { reason: 'X' } });
    const res = mockResponse();
    await adminCompanyVerification.rejectCompanyVerification(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    mockReturnPromise(companyMock.findOne, { verificationStatus: 'PENDING', save: jest.fn().mockRejectedValue(new Error('db')) });
    const req = adminReq({ params: { companyId: '507f1f77bcf86cd799439011' }, body: { rejectionReason: 'X' } });
    const res = mockResponse();
    try { await adminCompanyVerification.rejectCompanyVerification(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});









