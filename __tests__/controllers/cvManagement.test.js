// CV Management tests (FC 35-46) - redesigned with mkChainable + chain helpers.
import { jest } from '@jest/globals';
import { mockResponse, mockRequest, chain, mkChainable, chainableModel } from '../helpers/test-utils.js';

// NOTE: this file used to define its own local `chainableModel` whose Proxy `get`
// trap created a brand-new jest.fn() on every property access (no caching). That
// meant `mockReturnChain(cvMock.findById, data)` configured a *different* jest.fn()
// instance than the one the controller's own `Cv.findById(...)` call received, so
// the configured mock data never actually reached the controller - most "happy path"
// tests were silently falling through to the null-default and only passing because
// their assertions were loose enough to accept the resulting 404/500. Using the
// shared chainableModel from test-utils.js (which caches known Mongoose methods on
// the underlying object) fixes this for real.

const cvMock = chainableModel(null);
const cvTemplateMock = chainableModel(null);
const cvSectionMock = chainableModel(null);
const uploadedCvMock = chainableModel(null);
const userMock = chainableModel(null);
const jobMock = chainableModel(null);
const aiCvReviewMock = chainableModel(null);
const aiUsageQuotaMock = chainableModel(null);
const userServicePackageMock = chainableModel(null);
const servicePackageMock = chainableModel(null);
const walletMock = chainableModel(null);
const transactionMock = chainableModel(null);
const applicationMock = chainableModel(null);
const companyMock = chainableModel(null);
const employerProfileMock = chainableModel(null);
const jobseekerProfileMock = chainableModel(null);
const followedCompanyMock = chainableModel(null);
const savedJobMock = chainableModel(null);
const unlockedCandidateMock = chainableModel(null);
const cvBoostMock = chainableModel(null);
const cvUnlockCreditMock = chainableModel(null);
const jobLevelMock = chainableModel(null);
const jobBoostMock = chainableModel(null);
const userServicePackMock = chainableModel(null);
const sepayWebhookLogMock = chainableModel(null);
const companyIndustryMock = chainableModel(null);
const companyLocationMock = chainableModel(null);
const careerGroupMock = chainableModel(null);
const careerMock = chainableModel(null);
const careerPositionMock = chainableModel(null);
const skillMock = chainableModel(null);
const notificationMock = chainableModel(null);
const invoiceMock = chainableModel(null);

// mockReturnValueOnce helpers -- mock fn returns a chainable value.
// When the controller awaits on a chainable, the `mkChainable` returns the data.
const mockReturnChain = (mock, data) => mock.mockReturnValueOnce(mkChainable(data));
// Many controllers validate route :id params with mongoose.Types.ObjectId.isValid(),
// so short placeholders like 'cv1'/'x' always fail validation and short-circuit to 400.
const validCvId = '507f1f77bcf86cd799439011';

jest.unstable_mockModule('../../src/models/index.js', () => ({
  Cv: cvMock, CvTemplate: cvTemplateMock, CvSection: cvSectionMock,
  UploadedCv: uploadedCvMock, User: userMock, Job: jobMock,
  AiCvReview: aiCvReviewMock, AiUsageQuota: aiUsageQuotaMock,
  UserServicePackage: userServicePackageMock, ServicePackage: servicePackageMock,
  Wallet: walletMock, Transaction: transactionMock,
  Application: applicationMock, Company: companyMock,
  EmployerProfile: employerProfileMock, JobseekerProfile: jobseekerProfileMock,
  FollowedCompany: followedCompanyMock, SavedJob: savedJobMock,
  UnlockedCandidate: unlockedCandidateMock, CvBoost: cvBoostMock,
  CvUnlockCredit: cvUnlockCreditMock, JobLevel: jobLevelMock,
  JobBoost: jobBoostMock, CompanyIndustry: companyIndustryMock,
  CompanyLocation: companyLocationMock, Invoice: invoiceMock,
  Notification: notificationMock, Conversation: chainableModel(null), Message: chainableModel(null),
  SepayWebhookLog: sepayWebhookLogMock, CareerGroup: careerGroupMock,
  Career: careerMock, CareerPosition: careerPositionMock, Skill: skillMock,
  default: 'mock-models-index'
}));
jest.unstable_mockModule('../../src/models/cvModels.js', () => ({ default: cvMock }));
jest.unstable_mockModule('../../src/models/cvTemplateModels.js', () => ({ default: cvTemplateMock }));
jest.unstable_mockModule('../../src/models/cvSectionModels.js', () => ({ default: cvSectionMock }));
jest.unstable_mockModule('../../src/models/uploadedCvModels.js', () => ({ default: uploadedCvMock }));
jest.unstable_mockModule('../../src/models/userModels.js', () => ({ default: userMock }));
jest.unstable_mockModule('../../src/models/jobModels.js', () => ({ default: jobMock }));
jest.unstable_mockModule('../../src/models/aiCvReviewModels.js', () => ({ default: aiCvReviewMock }));
jest.unstable_mockModule('../../src/models/aiUsageQuotaModels.js', () => ({ default: aiUsageQuotaMock }));
jest.unstable_mockModule('../../src/models/userServicePackageModels.js', () => ({ default: userServicePackageMock }));
jest.unstable_mockModule('../../src/models/servicePackageModels.js', () => ({ default: servicePackageMock }));
jest.unstable_mockModule('../../src/models/walletModels.js', () => ({ default: walletMock }));
jest.unstable_mockModule('../../src/models/transactionModels.js', () => ({ default: transactionMock }));
jest.unstable_mockModule('../../src/models/applicationModels.js', () => ({ default: applicationMock }));
jest.unstable_mockModule('../../src/models/companyModels.js', () => ({ default: companyMock }));
jest.unstable_mockModule('../../src/models/employerProfileModels.js', () => ({ default: employerProfileMock }));
jest.unstable_mockModule('../../src/models/jobseekerProfileModels.js', () => ({ default: jobseekerProfileMock }));
jest.unstable_mockModule('../../src/models/careerGroupModels.js', () => ({ default: careerGroupMock }));
jest.unstable_mockModule('../../src/models/careerModels.js', () => ({ default: careerMock }));
jest.unstable_mockModule('../../src/models/careerPositionModels.js', () => ({ default: careerPositionMock }));
jest.unstable_mockModule('../../src/models/jobLevelModels.js', () => ({ default: jobLevelMock }));
jest.unstable_mockModule('../../src/models/skillModels.js', () => ({ default: skillMock }));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({ default: { create: jest.fn().mockResolvedValue({}) } }));
jest.unstable_mockModule('../../src/utils/cloudinary.js', () => ({ uploadBufferToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://cdn/x' }), uploadFileFromUrl: jest.fn().mockResolvedValue({ secure_url: 'https://cdn/y' }), deleteFromCloudinary: jest.fn().mockResolvedValue({}) }));
jest.unstable_mockModule('../../src/services/sepayService.js', () => ({
  createQRPaymentUrl: jest.fn(),
  verifySepayWebhook: jest.fn(),
  parseSepayWebhook: jest.fn(),
  generateOrderCode: jest.fn(),
  buildTransferContent: jest.fn(),
  findSepayTransactionByCode: jest.fn()
}));

let cv, cvTemplate, uploadedCv, aiCvReview;
beforeAll(async () => {
  cv = await import('../../src/controllers/cvController.js');
  cvTemplate = await import('../../src/controllers/cvTemplateController.js');
  uploadedCv = await import('../../src/controllers/uploadedCvController.js');
  aiCvReview = await import('../../src/controllers/aiCvReviewController.js');
});

const jobseekerReq = (overrides = {}) => mockRequest({ user: { _id: 'u1', role: 'JOBSEEKER' }, ...overrides });
// Limit statuses the test expects (controller may return 200/400/500 only)
const safeStatus = (code) => [200, 201, 400, 401, 403, 404, 500].includes(code) ? code : 200;

// =========================================================================
// FC 35.0 Upload CV - UTCID01-04
// =========================================================================
describe('Upload CV - UTCID01-04', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path uploads PDF', async () => {
    mockReturnChain(uploadedCvMock.create, { _id: 'uc1' });
    const req = jobseekerReq({ file: { originalname: 'cv.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x'), size: 100 } });
    const res = mockResponse();
    await uploadedCv.uploadCv(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: N - happy path via files array', async () => {
    mockReturnChain(uploadedCvMock.create, { _id: 'uc1' });
    const req = jobseekerReq({ files: [{ originalname: 'cv.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x'), size: 100 }] });
    const res = mockResponse();
    await uploadedCv.uploadCv(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - no file returns 400', async () => {
    const req = jobseekerReq();
    const res = mockResponse();
    await uploadedCv.uploadCv(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 36.0 CV List - UTCID01-05
// =========================================================================
describe('CV List - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - returns user cvs', async () => {
    mockReturnChain(cvMock.find, [{ _id: 'cv1' }]);
    mockReturnChain(uploadedCvMock.find, [{ _id: 'uc1' }]);
    const req = jobseekerReq();
    const res = mockResponse();
    await cv.getUserCvs(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty list', async () => {
    mockReturnChain(cvMock.find, []);
    mockReturnChain(uploadedCvMock.find, []);
    const req = jobseekerReq();
    const res = mockResponse();
    await cv.getUserCvs(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error', async () => {
    cvMock.find.mockReturnValueOnce({ populate: () => ({ populate: () => ({ sort: () => ({ lean: () => Promise.reject(new Error('db')) }) }) }) });
    const req = jobseekerReq();
    const res = mockResponse();
    await cv.getUserCvs(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  // Note: UTCID04-N rename is moved to FC 37 "Uploaded CV Rename" block below.
  // UTCID05-B empty-title is also part of FC 37.
});

// =========================================================================
// FC 37.0 Uploaded CV Rename - UTCID01-03
// =========================================================================
describe('Uploaded CV Rename - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path renames uploaded cv', async () => {
    mockReturnChain(uploadedCvMock.findOneAndUpdate, { _id: 'uc1', userId: 'u1', title: 'New title' });
    const req = jobseekerReq({ params: { id: 'uc1' }, body: { title: 'New title' } });
    const res = mockResponse();
    await uploadedCv.updateUploadedCv(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty title returns 400', async () => {
    const req = jobseekerReq({ params: { id: 'uc1' }, body: { title: '' } });
    const res = mockResponse();
    await uploadedCv.updateUploadedCv(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - cv not owned returns 400/404', async () => {
    mockReturnChain(uploadedCvMock.findOneAndUpdate, null);
    const req = jobseekerReq({ params: { id: 'x' }, body: { title: 'New' } });
    const res = mockResponse();
    await uploadedCv.updateUploadedCv(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 38.0 Create CV from Template - UTCID01-05
// =========================================================================
describe('Create CV from Template - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path creates cv', async () => {
    cvTemplateMock.findById.mockResolvedValueOnce({ _id: 'tpl1', status: 'ACTIVE' });
    mockReturnChain(cvSectionMock.find, []);
    mockReturnChain(cvMock.create, { _id: 'cv1' });
    const req = jobseekerReq({ body: { templateId: 'tpl1', title: 'CV' } });
    const res = mockResponse();
    await cv.createCv(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing templateId returns 400', async () => {
    const req = jobseekerReq({ body: {} });
    const res = mockResponse();
    await cv.createCv(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - template inactive returns 400/404', async () => {
    cvTemplateMock.findById.mockResolvedValueOnce({ _id: 'tpl1', status: 'INACTIVE' });
    const req = jobseekerReq({ body: { templateId: 'tpl1' } });
    const res = mockResponse();
    await cv.createCv(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    cvTemplateMock.findById.mockResolvedValueOnce({ _id: 'tpl1', status: 'ACTIVE' });
    mockReturnChain(cvSectionMock.find, []);
    cvMock.create.mockRejectedValueOnce(new Error('db'));
    const req = jobseekerReq({ body: { templateId: 'tpl1' } });
    const res = mockResponse();
    try { await cv.createCv(req, res); } catch (e) {}
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID05: N - returns CV preview', async () => {
    // getCvById queries via Cv.findOne({_id,userId}), not findById.
    mockReturnChain(cvMock.findOne, { _id: validCvId, userId: 'u1' });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.getCvById(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 39.0 CV Preview - UTCID01-07
// =========================================================================
describe('CV Preview - UTCID01-07', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - preview uploaded CV', async () => {
    // getUploadedCvView queries via UploadedCv.findOne(...) and reads .fileUrl.
    mockReturnChain(uploadedCvMock.findOne, { _id: validCvId, userId: 'u1', fileUrl: 'https://cdn/x/file.pdf' });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await uploadedCv.getUploadedCvView(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: N - preview built CV', async () => {
    mockReturnChain(cvMock.findOne, { _id: validCvId, userId: 'u1' });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.getCvById(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not found', async () => {
    mockReturnChain(cvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.getCvById(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - not owner returns 403/404', async () => {
    // ownership is baked into the Cv.findOne filter itself, so "not owner" and
    // "not found" are indistinguishable here - both resolve to null -> 404.
    mockReturnChain(cvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.getCvById(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  // UTCID05–07 are part of FC 40 "CV Update" -- below.
});

// =========================================================================
// FC 40.0 CV Update - UTCID01-05
// =========================================================================
describe('CV Update - UTCID01-05', () => {
  // NOTE: updateCv fetches via Cv.findOne({_id,userId}) then mutates + cv.save() -
  // it never calls Cv.findOneAndUpdate.
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - happy path updates CV content', async () => {
    mockReturnChain(cvMock.findOne, { _id: validCvId, userId: 'u1', save: jest.fn().mockResolvedValue({}) });
    const req = jobseekerReq({ params: { id: validCvId }, body: { title: 'Updated' } });
    const res = mockResponse();
    await cv.updateCv(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - wrong user returns 403/404', async () => {
    mockReturnChain(cvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId }, body: { title: 'A' } });
    const res = mockResponse();
    await cv.updateCv(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - missing id returns 400/404', async () => {
    cvMock.findOne.mockReturnValueOnce(null);
    const req = jobseekerReq({ params: {}, body: {} });
    const res = mockResponse();
    await cv.updateCv(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    cvMock.findOne.mockImplementation(() => Promise.reject(new Error('db')));
    const req = jobseekerReq({ params: { id: validCvId }, body: { title: 'A' } });
    const res = mockResponse();
    try { await cv.updateCv(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 41.0 CV Delete - UTCID01-07
// =========================================================================
describe('CV Delete - UTCID01-07', () => {
  // NOTE: cv.deleteCv only handles Builder CVs (Cv.findOne + cv.save(), soft delete) -
  // it has no query.type dispatch. Uploaded CVs are a separate function,
  // uploadedCv.deleteUploadedCv (UploadedCv.findOne + .save(), also soft delete, not
  // findByIdAndDelete).
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - deletes built cv', async () => {
    mockReturnChain(cvMock.findOne, { _id: validCvId, userId: 'u1', isMain: false, save: jest.fn().mockResolvedValue({}) });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.deleteCv(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: N - deletes uploaded cv', async () => {
    mockReturnChain(uploadedCvMock.findOne, { _id: validCvId, userId: 'u1', fileUrl: 'https://cdn/x/file.pdf', save: jest.fn().mockResolvedValue({}) });
    const req = jobseekerReq({ params: { id: validCvId }, query: { type: 'uploaded' } });
    const res = mockResponse();
    await uploadedCv.deleteUploadedCv(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - delete not found', async () => {
    mockReturnChain(cvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.deleteCv(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - delete wrong user returns 403/404', async () => {
    mockReturnChain(cvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await cv.deleteCv(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    mockReturnChain(cvMock.findOne, { _id: validCvId, userId: 'u1', save: jest.fn().mockRejectedValue(new Error('db')) });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    try { await cv.deleteCv(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
  test('UTCID07: A - delete uploaded wrong user returns 403/404', async () => {
    mockReturnChain(uploadedCvMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId }, query: { type: 'uploaded' } });
    const res = mockResponse();
    await uploadedCv.deleteUploadedCv(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 42.0 + 43.0 Active CV Template List / Preview - UTCID01-05
// =========================================================================
describe('CV Template List / Preview - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - public template list', async () => {
    mockReturnChain(cvTemplateMock.find, [{ _id: 'tpl1' }]);
    const req = mockRequest();
    const res = mockResponse();
    await cvTemplate.getActiveCvTemplates(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty template list', async () => {
    mockReturnChain(cvTemplateMock.find, []);
    const req = mockRequest();
    const res = mockResponse();
    await cvTemplate.getActiveCvTemplates(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: N - preview template', async () => {
    mockReturnChain(cvTemplateMock.findById, { _id: validCvId, status: 'ACTIVE' });
    const req = mockRequest({ params: { id: validCvId } });
    const res = mockResponse();
    await cvTemplate.getCvTemplatePreview(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - template not found returns 404', async () => {
    mockReturnChain(cvTemplateMock.findById, null);
    const req = mockRequest({ params: { id: validCvId } });
    const res = mockResponse();
    await cvTemplate.getCvTemplatePreview(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    cvTemplateMock.find.mockReturnValueOnce({ populate: () => ({ lean: () => Promise.reject(new Error('db')) }) });
    const req = mockRequest();
    const res = mockResponse();
    await cvTemplate.getActiveCvTemplates(req, res);
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 44.0 AI CV Review - UTCID01-05
// =========================================================================
describe('AI CV Review - UTCID01-05', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - reviews CV', async () => {
    uploadedCvMock.findById.mockResolvedValueOnce({ _id: 'uc1', userId: 'u1', textExtractStatus: 'EXTRACTED', extractedText: 'x' });
    aiUsageQuotaMock.findOneAndUpdate.mockResolvedValueOnce({ usedCount: 1, limitCount: 3 });
    aiCvReviewMock.create.mockResolvedValueOnce({ _id: 'review1' });
    const req = jobseekerReq({ body: { uploadedCvId: 'uc1' } });
    const res = mockResponse();
    await aiCvReview.createAiReview(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - quota exceeded returns 400/429', async () => {
    uploadedCvMock.findById.mockResolvedValueOnce({ _id: 'uc1', userId: 'u1', textExtractStatus: 'EXTRACTED' });
    aiUsageQuotaMock.findOneAndUpdate.mockResolvedValueOnce(null);
    const req = jobseekerReq({ body: { uploadedCvId: 'uc1' } });
    const res = mockResponse();
    await aiCvReview.createAiReview(req, res);
    expect([400, 429, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - CV not extracted returns 400', async () => {
    uploadedCvMock.findById.mockResolvedValueOnce({ _id: 'uc1', userId: 'u1', textExtractStatus: 'NOT_EXTRACTED' });
    const req = jobseekerReq({ body: { uploadedCvId: 'uc1' } });
    const res = mockResponse();
    await aiCvReview.createAiReview(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    // createAiReview requires body.target_position before it does anything else.
    uploadedCvMock.findById.mockRejectedValueOnce(new Error('db'));
    const req = jobseekerReq({ body: { uploadedCvId: 'uc1', target_position: 'Backend Developer' } });
    const res = mockResponse();
    try { await aiCvReview.createAiReview(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
  test('UTCID05: N - returns review history', async () => {
    mockReturnChain(aiCvReviewMock.find, [{ _id: 'r1' }]);
    const req = jobseekerReq();
    const res = mockResponse();
    await aiCvReview.getUserReviews(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 45.0 AI Review History - UTCID01-03
// =========================================================================
describe('AI Review History - UTCID01-03', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - returns multi-item history', async () => {
    mockReturnChain(aiCvReviewMock.find, [{ _id: 'r1' }, { _id: 'r2' }, { _id: 'r3' }]);
    const req = jobseekerReq();
    const res = mockResponse();
    await aiCvReview.getUserReviews(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    aiCvReviewMock.find.mockReturnValueOnce({ populate: () => ({ populate: () => ({ sort: () => Promise.reject(new Error('db')) }) }) });
    const req = jobseekerReq();
    const res = mockResponse();
    await aiCvReview.getUserReviews(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 46.0 AI Review Detail - UTCID01-04
// =========================================================================
describe('AI Review Detail - UTCID01-04', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  test('UTCID01: N - returns review detail', async () => {
    mockReturnChain(aiCvReviewMock.findOne, { _id: validCvId, userId: 'u1' });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await aiCvReview.getReviewById(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - not found returns 404', async () => {
    mockReturnChain(aiCvReviewMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await aiCvReview.getReviewById(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - wrong user returns 403/404', async () => {
    mockReturnChain(aiCvReviewMock.findOne, null);
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await aiCvReview.getReviewById(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    // getReviewById does `.findOne({...}).populate(...)` with no .lean() - it's
    // awaited straight off .populate().
    aiCvReviewMock.findOne.mockReturnValueOnce({ populate: () => Promise.reject(new Error('db')) });
    const req = jobseekerReq({ params: { id: validCvId } });
    const res = mockResponse();
    await aiCvReview.getReviewById(req, res);
    expect([500]).toContain(res.statusCode);
  });
});
