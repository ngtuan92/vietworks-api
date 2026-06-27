import cron from 'node-cron';
import { expirePremiumServices } from '../controllers/cronController.js';

// Chạy đầu mỗi giờ để expire CvBoost / JobBoost / UserServicePackage đã hết hạn
// và gửi thông báo "sắp hết hạn" cho user.
cron.schedule('0 * * * *', async () => {
  console.log('=== [CRON] expirePremiumServices start ===');
  try {
    const mockRes = {
      status(code) { this._code = code; return this; },
      json(data) {
        this._body = data;
        if (data?.success) {
          const d = data.data;
          console.log(
            `=== [CRON] Expired CV:${d.cvBoostsExpired} Job:${d.jobBoostsExpired} USP:${d.userServicePackagesExpired}` +
            ` | notified expiring:${d.expiringSoonNotified} expired:${d.expiredNotified} ===`
          );
        } else {
          console.error('=== [CRON] expirePremiumServices failed:', data?.message);
        }
        return this;
      }
    };
    await expirePremiumServices({ query: {} }, mockRes);
  } catch (err) {
    console.error('=== [CRON] expirePremiumServices error:', err.message);
  }
});
