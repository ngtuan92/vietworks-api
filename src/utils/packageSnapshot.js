export const buildPackageSnapshot = (pkg) => ({
  id: pkg?._id || pkg?.id || null,
  code: pkg?.code ?? null,
  name: pkg?.name ?? null,
  type: pkg?.packageType ?? pkg?.type ?? null,
  targetRole: pkg?.targetRole ?? null,
  price: pkg?.price ?? null,
  durationDays: pkg?.durationDays ?? null,
  quantity: pkg?.quantity ?? null,
  unit: pkg?.unit ?? null,
  benefits: pkg?.benefits ?? null,
  description: pkg?.description ?? null,
  aiPremiumAccess: pkg?.benefits?.aiPremiumAccess ?? pkg?.aiPremiumAccess ?? false
});
