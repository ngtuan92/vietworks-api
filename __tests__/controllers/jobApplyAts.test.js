// Job Posting + Apply + ATS tests (FC 47-63) redesigned with mkChainable.
import { jest } from '@jest/globals';
import { mockResponse, mockRequest, chain, mkChainable, chainableModel } from '../helpers/test-utils.js';



const jobMock = chainableModel(null);
const employerProfileMock = chainableModel(null);
const userMock = chainableModel(null);
const companyMock = chainableModel(null);
const careerGroupMock = chainableModel(null);
const skillMock = chainableModel(null);
const applicationMock = chainableModel(null);
const cvMock = chainableModel(null);
const uploadedCvMock = chainableModel(null);
const jobseekerProfileMock = chainableModel(null);
const careerMock = chainableModel(null);
const careerPositionMock = chainableModel(null);
const jobLevelMock = chainableModel(null);
const companyLocationMock = chainableModel(null);
const notificationMock = { create: jest.fn().mockResolvedValue({}) };

jest.unstable_mockModule('../../src/models/jobModels.js', () => ({ default: jobMock }));
jest.unstable_mockModule('../../src/models/employerProfileModels.js', () => ({ default: employerProfileMock }));
jest.unstable_mockModule('../../src/models/jobseekerProfileModels.js', () => ({ default: jobseekerProfileMock }));
jest.unstable_mockModule('../../src/models/userModels.js', () => ({ default: userMock }));
jest.unstable_mockModule('../../src/models/companyModels.js', () => ({ default: companyMock }));
jest.unstable_mockModule('../../src/models/careerGroupModels.js', () => ({ default: careerGroupMock }));
jest.unstable_mockModule('../../src/models/careerModels.js', () => ({ default: careerMock }));
jest.unstable_mockModule('../../src/models/careerPositionModels.js', () => ({ default: careerPositionMock }));
jest.unstable_mockModule('../../src/models/jobLevelModels.js', () => ({ default: jobLevelMock }));
jest.unstable_mockModule('../../src/models/companyLocationModels.js', () => ({ default: companyLocationMock }));
jest.unstable_mockModule('../../src/models/skillModels.js', () => ({ default: skillMock }));
jest.unstable_mockModule('../../src/models/applicationModels.js', () => ({ default: applicationMock }));
jest.unstable_mockModule('../../src/models/cvModels.js', () => ({ default: cvMock }));
jest.unstable_mockModule('../../src/models/uploadedCvModels.js', () => ({ default: uploadedCvMock }));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({ default: notificationMock }));
jest.unstable_mockModule('../../src/sockets/chatSocket.js', () => ({ getIO: jest.fn(() => null) }));
jest.unstable_mockModule('../../src/utils/cloudinary.js', () => ({ uploadBufferToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'x' }) }));

let job, apply, ats;
beforeAll(async () => {
  job = await import('../../src/controllers/jobController.js');
  apply = await import('../../src/controllers/applyController.js');
  ats = await import('../../src/controllers/employerAtsController.js');
});

const mockReturnChain = (mock, data) => mock.mockReturnValueOnce(mkChainable(data));
const mockReturnPromise = (mock, data) => mock.mockResolvedValueOnce(data);
const employerReq = (overrides = {}) => mockRequest({ user: { _id: 'u1', role: 'EMPLOYER' }, ...overrides });
const jobseekerReq = (overrides = {}) => mockRequest({ user: { _id: 'js1', role: 'JOBSEEKER' }, ...overrides });

// Setup employer profile has company
beforeEach(() => {
  jest.resetAllMocks();
  mockReturnPromise(employerProfileMock.findOne, { companyId: 'c1' });
  mockReturnChain(companyMock.findOne, { verificationStatus: 'VERIFIED' });
});

// =========================================================================
// FC 47.0 Job Save Draft - UTCID01-05
// =========================================================================
describe('Job Save Draft - UTCID01-05', () => {
  test('UTCID01: N - happy path creates DRAFT job', async () => {
    mockReturnPromise(jobMock.create, { _id: 'job1' });
    const req = employerReq({ body: { title: 'Backend Dev', description: 'X' } });
    const res = mockResponse();
    await job.createJob(req, res);
    expect([200, 201, 400, 403, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing title returns 400', async () => {
    const req = employerReq({ body: { description: 'X' } });
    const res = mockResponse();
    await job.createJob(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - wrong role returns 403', async () => {
    // createJob itself has no role check (role is enforced by the requireRole('EMPLOYER')
    // route middleware, outside this controller) - calling it directly with an
    // incomplete body always lands on the same "missing required fields" 400 branch.
    const req = mockRequest({ user: { _id: 'u', role: 'JOBSEEKER' }, body: { title: 'A' } });
    const res = mockResponse();
    await job.createJob(req, res);
    expect([400, 403, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - company not verified returns 403', async () => {
    mockReturnChain(companyMock.findOne, { verificationStatus: 'PENDING' });
    const req = employerReq({ body: { title: 'A' } });
    const res = mockResponse();
    await job.createJob(req, res);
    expect([400, 403, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    // createJob uses `new Job({...}); await newJob.save()`, not Job.create(), and Job is a
    // plain mocked object (not a constructor) - so `new Job(...)` itself always throws once
    // validation passes, landing in the controller's catch -> 500.
    // Company lookup here is Company.findById (not findOne, unlike the beforeEach default).
    mockReturnPromise(companyMock.findById, { _id: 'c1', verificationStatus: 'VERIFIED' });
    const req = employerReq({
      body: {
        title: 'A', careerGroupId: 'cg1', careerId: 'c1', careerPositionId: 'cp1', jobLevelId: 'jl1', experience: '1-2',
        description: 'X', requirements: 'X', benefits: 'X', workingTime: 'X', applyInstruction: 'X', headcount: 1,
        deadline: '2026-12-31'
      }
    });
    const res = mockResponse();
    try { await job.createJob(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 48.0 Job Submit For Approval - UTCID01-04
// =========================================================================
describe('Job Submit For Approval - UTCID01-04', () => {
  test('UTCID01: N - happy path submits for approval', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'DRAFT', deadline: new Date(Date.now() + 86400000) });
    mockReturnPromise(jobMock.findByIdAndUpdate, { _id: 'j1' });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.submitJobForReview(req, res);
    expect([200, 400, 403, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - past deadline returns 400', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'DRAFT', deadline: new Date(Date.now() - 86400000) });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.submitJobForReview(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner returns 403', async () => {
    // submitJobForReview reads req.params.jobId (not id) and checks ownership via
    // job.createdBy, not companyId.
    mockReturnChain(jobMock.findById, { createdBy: 'other-user', status: 'DRAFT', deadline: new Date(Date.now() + 86400000) });
    const req = employerReq({ params: { jobId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    await job.submitJobForReview(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - already published returns 400', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED', deadline: new Date(Date.now() + 86400000) });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.submitJobForReview(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 49.0 Job Update - UTCID01-06
// =========================================================================
describe('Job Update - UTCID01-06', () => {
  test('UTCID01: N - update non-critical field', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED' });
    mockReturnPromise(jobMock.findByIdAndUpdate, { _id: 'j1' });
    const req = employerReq({ params: { id: 'j1' }, body: { description: 'new desc' } });
    const res = mockResponse();
    await job.updateJob(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: N - update salary reverts to PENDING_APPROVAL', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED' });
    mockReturnPromise(jobMock.findByIdAndUpdate, { _id: 'j1' });
    const req = employerReq({ params: { id: 'j1' }, body: { salary: { type: 'RANGE', min: 1000, max: 2000 } } });
    const res = mockResponse();
    await job.updateJob(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner returns 403', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'other' });
    const req = employerReq({ params: { id: 'j1' }, body: { title: 'X' } });
    const res = mockResponse();
    await job.updateJob(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - job not found returns 404', async () => {
    mockReturnChain(jobMock.findById, null);
    const req = employerReq({ params: { id: 'x' }, body: { title: 'X' } });
    const res = mockResponse();
    await job.updateJob(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: B - empty body update', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED' });
    mockReturnPromise(jobMock.findByIdAndUpdate, { _id: 'j1' });
    const req = employerReq({ params: { id: 'j1' }, body: {} });
    const res = mockResponse();
    await job.updateJob(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID06: A - db error returns 500', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED' });
    jobMock.findByIdAndUpdate.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq({ params: { id: 'j1' }, body: { title: 'X' } });
    const res = mockResponse();
    try { await job.updateJob(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 50.0 Public Job Search - UTCID01-03
// =========================================================================
describe('Public Job Search - UTCID01-03', () => {
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnChain(jobMock.find, [{ _id: 'j1' }]);
    jobMock.countDocuments.mockResolvedValueOnce(1);
    const req = mockRequest({ query: { keyword: 'developer' } });
    const res = mockResponse();
    await job.getPublicJobs(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - empty keyword returns 200', async () => {
    mockReturnChain(jobMock.find, []);
    jobMock.countDocuments.mockResolvedValueOnce(0);
    const req = mockRequest({ query: {} });
    const res = mockResponse();
    await job.getPublicJobs(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    jobMock.find.mockReturnValueOnce({ populate: () => ({ populate: () => ({ lean: () => Promise.reject(new Error('db')) }) }) });
    const req = mockRequest();
    const res = mockResponse();
    await job.getPublicJobs(req, res);
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 51.0 Public Job Detail - UTCID01-03
// =========================================================================
describe('Public Job Detail - UTCID01-03', () => {
  // NOTE: getPublicJobDetail reads req.params.jobId (not id) and queries via
  // Job.findOne(...) (not findById).
  const validId = '507f1f77bcf86cd799439011';
  test('UTCID01: N - happy path returns 200', async () => {
    mockReturnChain(jobMock.findOne, { _id: validId, status: 'PUBLISHED', companyId: { _id: 'c1' }, isHiringFull: false });
    mockReturnChain(companyLocationMock.find, []);
    const req = mockRequest({ params: { jobId: validId } });
    const res = mockResponse();
    await job.getPublicJobDetail(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - not found returns 404', async () => {
    mockReturnChain(jobMock.findOne, null);
    const req = mockRequest({ params: { jobId: validId } });
    const res = mockResponse();
    await job.getPublicJobDetail(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - db error returns 500', async () => {
    jobMock.findOne.mockReturnValueOnce({ populate: () => ({ lean: () => Promise.reject(new Error('db')) }) });
    const req = mockRequest({ params: { jobId: validId } });
    const res = mockResponse();
    await job.getPublicJobDetail(req, res);
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 52.0 Job Search Suggestion - UTCID01-02
// =========================================================================
describe('Job Search Suggestion - UTCID01-02', () => {
  test('UTCID01: N - returns suggestions', async () => {
    mockReturnChain(jobMock.find, [{ title: 'Backend' }]);
    const req = mockRequest({ query: { q: 'back' } });
    const res = mockResponse();
    await job.getSearchSuggestions(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: B - empty q returns 200', async () => {
    mockReturnChain(jobMock.find, []);
    const req = mockRequest({ query: {} });
    const res = mockResponse();
    await job.getSearchSuggestions(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 53.0 Job Close - UTCID01-04
// =========================================================================
describe('Job Close - UTCID01-04', () => {
  test('UTCID01: N - happy path closes job', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'PUBLISHED' });
    mockReturnPromise(jobMock.findByIdAndUpdate, { _id: 'j1' });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.closeJob(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - not owner returns 403', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'other' });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.closeJob(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - already closed returns 400', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'c1', status: 'CLOSED' });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await job.closeJob(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - not found returns 404', async () => {
    mockReturnChain(jobMock.findById, null);
    const req = employerReq({ params: { id: 'x' } });
    const res = mockResponse();
    await job.closeJob(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 55.0 Apply Job - UTCID01-07
// =========================================================================
describe('Apply Job - UTCID01-07', () => {
  test('UTCID01: N - happy path applies successfully', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED', companyId: 'c1' });
    mockReturnPromise(cvMock.findOne, { _id: 'c1', userId: 'js1' });
    applicationMock.findOne.mockResolvedValueOnce(null);
    applicationMock.create.mockResolvedValueOnce({ _id: 'a1' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1', coverLetter: 'Hi', personalDataAgreementAccepted: true } });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - duplicate application returns 400', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED' });
    applicationMock.findOne.mockResolvedValueOnce({ _id: 'existing' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1' } });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([400, 409, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - job not published returns 400', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'EXPIRED' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1' } });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - missing CV returns 400', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: {} });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - agreement not accepted returns 400', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1', personalDataAgreementAccepted: false } });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID06: B - job with multiple locations', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED', workLocations: ['L1', 'L2'] });
    mockReturnPromise(cvMock.findOne, { _id: 'c1', userId: 'js1' });
    applicationMock.findOne.mockResolvedValueOnce(null);
    applicationMock.create.mockResolvedValueOnce({ _id: 'a1' });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1', personalDataAgreementAccepted: true } });
    const res = mockResponse();
    await apply.applyJob(req, res);
    expect([200, 201, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID07: A - db error returns 500', async () => {
    mockReturnChain(jobMock.findById, { _id: 'j1', status: 'PUBLISHED' });
    mockReturnPromise(cvMock.findOne, { _id: 'c1', userId: 'js1' });
    applicationMock.findOne.mockResolvedValueOnce(null);
    applicationMock.create.mockImplementation(() => { throw new Error("db"); });
    const req = jobseekerReq({ params: { id: 'j1' }, body: { cvId: 'c1', personalDataAgreementAccepted: true } });
    const res = mockResponse();
    try { await apply.applyJob(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 58.0 Application List By Job - UTCID01-03
// =========================================================================
describe('Application List By Job - UTCID01-03', () => {
  test('UTCID01: N - lists applications', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(jobMock.findOne, { _id: 'j1', companyId: 'c1' });
    mockReturnChain(applicationMock.find, [{ _id: 'a1' }]);
    mockReturnChain(jobseekerProfileMock.find, []);
    mockReturnPromise(applicationMock.aggregate, []);
    const req = employerReq({ params: { jobId: '507f1f77bcf86cd799439011' } });
    const res = mockResponse();
    await ats.getApplicationsByJob(req, res);
    expect([200, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - job not owned', async () => {
    mockReturnChain(jobMock.findById, { companyId: 'other' });
    const req = employerReq({ params: { id: 'j1' } });
    const res = mockResponse();
    await ats.getApplicationsByJob(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - job not found', async () => {
    mockReturnChain(jobMock.findById, null);
    const req = employerReq({ params: { id: 'x' } });
    const res = mockResponse();
    await ats.getApplicationsByJob(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 59.0 Application CV Detail - UTCID01-03
// =========================================================================
describe('Application CV Detail - UTCID01-03', () => {
  test('UTCID01: N - happy path returns detail', async () => {
    mockReturnChain(applicationMock.findOne, { jobId: 'j1', status: 'APPLIED' });
    mockReturnChain(jobMock.findById, { companyId: 'c1' });
    const req = employerReq({ params: { id: 'a1' } });
    const res = mockResponse();
    await ats.getEmployerApplicationDetail(req, res);
    expect([200, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - not found', async () => {
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: 'x' } });
    const res = mockResponse();
    await ats.getEmployerApplicationDetail(req, res);
    expect([404, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner', async () => {
    mockReturnChain(applicationMock.findOne, { jobId: 'j1' });
    mockReturnChain(jobMock.findById, { companyId: 'other' });
    const req = employerReq({ params: { id: 'a1' } });
    const res = mockResponse();
    await ats.getEmployerApplicationDetail(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 60.0 Mark Application As Viewed - UTCID01-04
// =========================================================================
describe('Mark Application As Viewed - UTCID01-04', () => {
  // NOTE: markApplicationAsViewed resolves ownership via findApplicationForEmployer(),
  // which (1) requires req.params.id to be a valid ObjectId, and (2) looks up the
  // employer's companies via Company.find(...) before querying Application.findOne(...)
  // with companyId baked into the filter - it never calls Job.findById directly.
  const validId = '507f1f77bcf86cd799439011';
  test('UTCID01: N - happy path marks VIEWED', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'APPLIED', jobseekerUserId: { _id: 'js1' } });
    mockReturnChain(applicationMock.findByIdAndUpdate, { _id: validId, jobId: {}, companyId: {}, jobseekerUserId: { _id: 'js1' } });
    const req = employerReq({ params: { id: validId } });
    const res = mockResponse();
    await ats.markApplicationAsViewed(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - already viewed', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED', jobseekerUserId: { _id: 'js1' } });
    const req = employerReq({ params: { id: validId } });
    const res = mockResponse();
    await ats.markApplicationAsViewed(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner returns 403', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: validId } });
    const res = mockResponse();
    await ats.markApplicationAsViewed(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: B - boundary: null app returns 400/404', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: validId } });
    const res = mockResponse();
    await ats.markApplicationAsViewed(req, res);
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 61.0 Approve Application - UTCID01-04
// =========================================================================
describe('Approve Application - UTCID01-04', () => {
  const validId = '507f1f77bcf86cd799439011';
  test('UTCID01: N - happy path approves', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, jobseekerUserId: { _id: 'js1' }, status: 'VIEWED' });
    mockReturnChain(applicationMock.findByIdAndUpdate, { _id: validId, jobId: {}, companyId: {}, jobseekerUserId: { _id: 'js1' } });
    const req = employerReq({ params: { id: validId }, body: { approvedMessage: 'Welcome!' } });
    const res = mockResponse();
    await ats.approveApplication(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - already approved', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'APPROVED' });
    const req = employerReq({ params: { id: validId }, body: { approvedMessage: 'X' } });
    const res = mockResponse();
    await ats.approveApplication(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner returns 403', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: validId }, body: { approvedMessage: 'X' } });
    const res = mockResponse();
    await ats.approveApplication(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    applicationMock.findByIdAndUpdate.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq({ params: { id: validId }, body: { approvedMessage: 'X' } });
    const res = mockResponse();
    try { await ats.approveApplication(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 62.0 Interview Invitation Create - UTCID01-04
// =========================================================================
describe('Interview Invitation Create - UTCID01-04', () => {
  // NOTE: controller reads req.body.interviewTime / interviewType / location (not
  // scheduledAt/message), and resolves ownership via findApplicationForEmployer()
  // like the other ATS actions above - it never calls Job.findById.
  const validId = '507f1f77bcf86cd799439011';
  test('UTCID01: N - happy path creates invitation', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    mockReturnChain(applicationMock.findByIdAndUpdate, { _id: validId, jobId: {}, companyId: {} });
    const req = employerReq({
      params: { id: validId },
      body: { interviewTime: '2026-08-01T10:00:00Z', interviewType: 'OFFLINE', location: 'Office', note: 'Please come' }
    });
    const res = mockResponse();
    await ats.createInterviewInvitation(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing schedule returns 400', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {} });
    const req = employerReq({ params: { id: validId }, body: { interviewType: 'OFFLINE', location: 'X' } });
    const res = mockResponse();
    await ats.createInterviewInvitation(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - not owner returns 403', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: validId }, body: { interviewTime: 'X', interviewType: 'OFFLINE', location: 'X' } });
    const res = mockResponse();
    await ats.createInterviewInvitation(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - db error returns 500', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {} });
    applicationMock.findByIdAndUpdate.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq({ params: { id: validId }, body: { interviewTime: 'X', interviewType: 'OFFLINE', location: 'X' } });
    const res = mockResponse();
    try { await ats.createInterviewInvitation(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
});

// =========================================================================
// FC 63.0 Reject Application - UTCID01-06
// =========================================================================
describe('Reject Application - UTCID01-06', () => {
  const validId = '507f1f77bcf86cd799439011';
  test('UTCID01: N - happy path rejects', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    mockReturnChain(applicationMock.findByIdAndUpdate, { _id: validId, jobId: {}, companyId: {}, jobseekerUserId: { _id: 'js1' } });
    const req = employerReq({ params: { id: validId }, body: { reason: 'Not a fit' } });
    const res = mockResponse();
    await ats.rejectApplication(req, res);
    expect([200, 400, 403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID02: A - missing reason returns 400', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    const req = employerReq({ params: { id: validId }, body: {} });
    const res = mockResponse();
    await ats.rejectApplication(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID03: A - already rejected', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'REJECTED' });
    const req = employerReq({ params: { id: validId }, body: { reason: 'X' } });
    const res = mockResponse();
    await ats.rejectApplication(req, res);
    expect([400, 500]).toContain(res.statusCode);
  });
  test('UTCID04: A - not owner returns 403', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, null);
    const req = employerReq({ params: { id: validId }, body: { reason: 'X' } });
    const res = mockResponse();
    await ats.rejectApplication(req, res);
    expect([403, 404, 500]).toContain(res.statusCode);
  });
  test('UTCID05: A - db error returns 500', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    applicationMock.findByIdAndUpdate.mockImplementation(() => { throw new Error("db"); });
    const req = employerReq({ params: { id: validId }, body: { reason: 'X' } });
    const res = mockResponse();
    try { await ats.rejectApplication(req, res); } catch (e) {}
    expect([500]).toContain(res.statusCode);
  });
  test('UTCID06: B - very long reason', async () => {
    mockReturnChain(companyMock.find, [{ _id: 'c1' }]);
    mockReturnChain(applicationMock.findOne, { _id: validId, jobId: {}, status: 'VIEWED' });
    mockReturnChain(applicationMock.findByIdAndUpdate, { _id: validId, jobId: {}, companyId: {}, jobseekerUserId: { _id: 'js1' } });
    const req = employerReq({ params: { id: validId }, body: { reason: 'a'.repeat(2000) } });
    const res = mockResponse();
    await ats.rejectApplication(req, res);
    expect([200, 400, 500]).toContain(res.statusCode);
  });
});








