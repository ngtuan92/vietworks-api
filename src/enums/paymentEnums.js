export const ServicePackageCode = {
  BOOST_CV_7_DAYS: 'BOOST_CV_7_DAYS',
  BOOST_CV_30_DAYS: 'BOOST_CV_30_DAYS',
  UNLOCK_CV_SINGLE: 'UNLOCK_CV_SINGLE',
  UNLOCK_CV_50_30_DAYS: 'UNLOCK_CV_50_30_DAYS',
  UNLOCK_CV_100_30_DAYS: 'UNLOCK_CV_100_30_DAYS',
  PREMIUM_JOB_7_DAYS: 'PREMIUM_JOB_7_DAYS',
  PREMIUM_JOB_14_DAYS: 'PREMIUM_JOB_14_DAYS',
  PREMIUM_JOB_30_DAYS: 'PREMIUM_JOB_30_DAYS'
};

export const ServicePackageTargetRole = {
  JOBSEEKER: 'JOBSEEKER',
  EMPLOYER: 'EMPLOYER',
  ALL: 'ALL'
};

export const ServicePackageType = {
  CV_BOOST: 'CV_BOOST',
  CV_UNLOCK: 'CV_UNLOCK',
  CV_UNLOCK_BUNDLE: 'CV_UNLOCK_BUNDLE',
  PREMIUM_JOB: 'PREMIUM_JOB'
};

export const ServicePackageUnit = {
  CV: 'CV',
  JOB: 'JOB'
};

export const WalletStatus = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED'
};

export const TransactionType = {
  WALLET_DEPOSIT: 'WALLET_DEPOSIT',
  PACKAGE_PURCHASE: 'PACKAGE_PURCHASE',
  CV_UNLOCK_SINGLE: 'CV_UNLOCK_SINGLE',
  CV_UNLOCK_BY_PACKAGE: 'CV_UNLOCK_BY_PACKAGE',
  REFUND: 'REFUND',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT'
};

export const TransactionStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED'
};

export const PaymentMethod = {
  WALLET: 'WALLET',
  SEPAY: 'SEPAY'
};



export const PaymentProvider = {
  SEPAY: 'SETTLEMENT'
};



export const PackageTargetType = {
  JOB: 'JOB',
  CV: 'CV',
  USER: 'USER',
  WALLET: 'WALLET'
};

export const UserServicePackageStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

export const CvUnlockCreditStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  USED_UP: 'USED_UP',
  CANCELLED: 'CANCELLED'
};

export const UnlockMethod = {
  SINGLE_PURCHASE: 'SINGLE_PURCHASE',
  PACKAGE_CREDIT: 'PACKAGE_CREDIT'
};
