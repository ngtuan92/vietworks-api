import cron from 'node-cron';
import { expirePremiumServices } from '../controllers/cronController.js';
import { notifyExpiringSoonOnly } from '../controllers/expireNotifyController.js';

// ── Các khung giờ cố định mỗi ngày (giờ VN) ──
//   07:00 → tạo IN-APP "sắp hết hạn" (≤ 3 ngày) → ném vào DB, user vào web là thấy
//   08:00 → set EXPIRED cho gói hết hạn + thông báo "đã hết hạn" (1 lần)
//   09:00 → gửi EMAIL "sắp hết hạn" (≤ 2 ngày cuối)
const TZ = 'Asia/Ho_Chi_Minh';

const makeRes = (label) => ({
  status() { return this; },
  json(data) {
    if (data?.success) console.log(`=== [CRON ${label}] ${JSON.stringify(data.data)} ===`);
    else console.error(`=== [CRON ${label}] failed:`, data?.message);
    return this;
  }
});

// 07:00 — tạo IN-APP "sắp hết hạn" (≤ 3 ngày) vào DB
cron.schedule('0 7 * * *', async () => {
  console.log('=== [CRON 07:00] notifyExpiringSoon (in-app) start ===');
  try {
    await notifyExpiringSoonOnly(
      { query: { slot: 'web', days: '3', channels: 'inapp' } },
      makeRes('07:00 in-app')
    );
  } catch (err) {
    console.error('=== [CRON 07:00] error:', err.message);
  }
}, { timezone: TZ });

// 08:00 — expire + notify đã hết hạn (bỏ qua phase "sắp hết hạn")
cron.schedule('0 8 * * *', async () => {
  console.log('=== [CRON 08:00] expirePremiumServices start ===');
  try {
    await expirePremiumServices({ query: { skipExpiringSoon: '1' } }, makeRes('08:00 expire'));
  } catch (err) {
    console.error('=== [CRON 08:00] error:', err.message);
  }
}, { timezone: TZ });

// 09:00 — gửi EMAIL "sắp hết hạn" cho gói còn ≤ 2 ngày
cron.schedule('0 9 * * *', async () => {
  console.log('=== [CRON 09:00] notifyExpiringSoon (email) start ===');
  try {
    await notifyExpiringSoonOnly(
      { query: { slot: 'email', days: '2', channels: 'email' } },
      makeRes('09:00 email')
    );
  } catch (err) {
    console.error('=== [CRON 09:00] error:', err.message);
  }
}, { timezone: TZ });
