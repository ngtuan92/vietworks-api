import cron from 'node-cron';
import Job from '../models/Job.js'; // Đường dẫn tới Model Job của bạn

// Lên lịch chạy vào lúc 00:00 mỗi đêm
cron.schedule('0 0 * * *', async () => {
  console.log('=== [CRON] Bắt đầu quét và xử lý các bài đăng quá hạn deadline ===');
  try {
    const today = new Date();

    // Tìm tất cả các tin đang mở (PUBLISHED) nhưng có deadline nhỏ hơn thời gian hiện tại
    const result = await Job.updateMany(
      {
        status: 'PUBLISHED', // hoặc JobStatus.PUBLISHED nếu bạn dùng enum
        deadline: { $lt: today }
      },
      {
        $set: { status: 'EXPIRED' } // Chuyển trạng thái sang Hết hạn (Đảm bảo model có status này)
      }
    );

    console.log(`=== [CRON] Thành công! Đã tự động chuyển đổi ${result.modifiedCount} tin tuyển dụng sang trạng thái EXPIRED. ===`);
  } catch (error) {
    console.error('=== [CRON] Lỗi trong quá trình quét gia hạn:', error.message);
  }
});