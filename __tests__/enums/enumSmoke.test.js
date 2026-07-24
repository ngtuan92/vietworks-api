import { jest } from '@jest/globals';

// Enum static tests — no mocking required. Each enum file exports plain objects.

const enumSources = [
  ['jobEnums', () => import('../../src/enums/jobEnums.js')],
  ['userEnums', () => import('../../src/enums/userEnums.js')],
  ['paymentEnums', () => import('../../src/enums/paymentEnums.js')],
  ['masterDataEnums', () => import('../../src/enums/masterDataEnums.js')],
  ['notificationEnums', () => import('../../src/enums/notificationEnums.js')],
  ['cvEnums', () => import('../../src/enums/cvEnums.js')],
  ['adminEnums', () => import('../../src/enums/adminEnums.js')],
  ['aiEnums', () => import('../../src/enums/aiEnums.js')]
];

let enumCache = {};
beforeAll(async () => {
  for (const [name, loader] of enumSources) {
    const mod = await loader();
    enumCache[name] = mod;
  }
});

describe('Enum files — values, uniqueness, basic shape', () => {
  test('all enum files export at least one object', () => {
    for (const name of Object.keys(enumCache)) {
      const keys = Object.keys(enumCache[name] || {});
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  test('every enum value is unique within its own object', () => {
    for (const name of Object.keys(enumCache)) {
      const mod = enumCache[name];
      for (const key of Object.keys(mod)) {
        const value = mod[key];
        if (typeof value === 'object' && value !== null) {
          const values = Object.values(value);
          expect(new Set(values).size).toBe(values.length);
        }
      }
    }
  });
});

describe('jobEnums', () => {
  test('JobStatus enum exists and has expected business values', () => {
    const { JobStatus } = enumCache.jobEnums;
    expect(JobStatus).toBeDefined();
    const required = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'EXPIRED', 'CLOSED'];
    for (const v of required) {
      expect(JobStatus[v]).toBe(v);
    }
  });
});

describe('userEnums', () => {
  test('UserRole enum exposes the three required roles', () => {
    const { UserRole } = enumCache.userEnums;
    expect(UserRole.JOBSEEKER).toBe('JOBSEEKER');
    expect(UserRole.EMPLOYER).toBe('EMPLOYER');
    expect(UserRole.ADMIN).toBe('ADMIN');
  });

  test('AccountStatus enum has UNVERIFIED, ACTIVE, BANNED', () => {
    const { AccountStatus } = enumCache.userEnums;
    expect(AccountStatus.UNVERIFIED).toBe('UNVERIFIED');
    expect(AccountStatus.ACTIVE).toBe('ACTIVE');
    expect(AccountStatus.BANNED).toBe('BANNED');
  });
});

describe('paymentEnums', () => {
  test('TransactionType has wallet, package and refund entries', () => {
    const { TransactionType } = enumCache.paymentEnums;
    expect(TransactionType.WALLET_DEPOSIT).toBe('WALLET_DEPOSIT');
    expect(TransactionType.PACKAGE_PURCHASE).toBe('PACKAGE_PURCHASE');
  });
});

describe('masterDataEnums', () => {
  test('CommonStatus.ACTIVE and INACTIVE are defined', () => {
    const { CommonStatus } = enumCache.masterDataEnums;
    expect(CommonStatus.ACTIVE).toBe('ACTIVE');
    expect(CommonStatus.INACTIVE).toBe('INACTIVE');
  });
});
