import cron from 'node-cron';
import { Job } from '../models/index.js';
import { JobStatus } from '../enums/jobEnums.js';

// Chạy lúc 00:00 mỗi ngày để tự động đóng các tin tuyển dụng quá hạn.
cron.schedule('0 0 * * *', async () => {
  console.log('=== [CRON] Bắt đầu quét các tin tuyển dụng quá hạn ===');

  try {
    const now = new Date();

    const result = await Job.updateMany(
      {
        status: JobStatus.PUBLISHED,
        deadline: { $lt: now }
      },
      {
        $set: { status: JobStatus.EXPIRED }
      }
    );

    console.log(`=== [CRON] Đã chuyển ${result.modifiedCount} tin tuyển dụng sang trạng thái EXPIRED ===`);
  } catch (error) {
    console.error('=== [CRON] Lỗi khi xử lý tin tuyển dụng quá hạn:', error.message);
  }
});
