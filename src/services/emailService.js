
import { EmailDeliveryStatus, EmailProvider } from '../enums/notificationEnums.js';

const createMailTransporter = async () => {
  const hasSmtpConfig =
    process.env.MAIL_HOST &&
    process.env.MAIL_PORT &&
    process.env.MAIL_USERNAME &&
    process.env.MAIL_PASSWORD &&
    process.env.MAIL_FROM_ADDRESS &&
    process.env.MAIL_FROM_NAME;

  if (!hasSmtpConfig) {
    throw new Error('Thiếu cấu hình gửi email');
  }

  const nodemailerModule = await import('nodemailer');
  const nodemailer = nodemailerModule.default;

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendHtmlEmail = async ({ toEmail, subject, html }) => {
  const transporter = await createMailTransporter();

  await transporter.sendMail({
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
    to: toEmail,
    subject,
    html
  });

  return { delivered: true, mode: 'SMTP' };
};

/**
 * Gửi email nghiệp vụ và ghi log kết quả vào email_logs.
 * Dùng cho các luồng ATS: CV viewed, interview invitation, rejection, new message.
 *
 * @param {object} opts
 * @param {string} opts.receiverUserId  - ID người nhận (ObjectId string)
 * @param {string} opts.toEmail         - Địa chỉ email người nhận
 * @param {string} opts.subject         - Tiêu đề email
 * @param {string} opts.html            - Nội dung HTML
 * @param {string} [opts.notificationId] - ID notification liên quan (optional)
 * @returns {Promise<object>} EmailLog document đã lưu
 */
export const sendBusinessEmail = async ({ receiverUserId, toEmail, subject, html, notificationId = null }) => {
  try {
    await sendHtmlEmail({ toEmail, subject, html });
    return { success: true };
  } catch (err) {
    console.error('Lỗi gửi email:', err);
    return { success: false, error: err?.message };
  }
};


export const renderEmailActionButton = (url, label = 'Xem chi tiết') => {
  if (!url) return '';
  return `
    <div style="margin: 28px 0 8px; text-align: center;">
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0056B3; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-size: 14px; font-weight: 800; letter-spacing: .2px; box-shadow: 0 12px 24px rgba(0, 86, 179, 0.22);">
        ${label}
      </a>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 12px; line-height: 1.5;">Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:<br><span style="color: #0056B3; word-break: break-all;">${url}</span></p>
    </div>
  `;
};
// ─── Email templates cho từng loại sự kiện nghiệp vụ ───────────────────────

/**
 * Gửi email thông báo nhà tuyển dụng đã xem CV.
 */
export const sendCvViewedEmail = ({ receiverUserId, toEmail, jobseekerName, employerName, jobTitle, companyName, companyLogo, jobUrl, actionUrl, actionLabel, notificationId }) => {
  const subject = `VietWorks - ${employerName || companyName} đã xem CV của bạn`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #003f87;">Nhà tuyển dụng vừa xem CV của bạn! 👀</h2>
        <p>Xin chào <strong>${jobseekerName || 'bạn'}</strong>,</p>
        <p><strong>${employerName || companyName || 'Nhà tuyển dụng'}</strong> đã xem CV của bạn ứng tuyển vào vị trí <strong>${jobTitle}</strong>.</p>
        <p>Đây là tín hiệu tích cực! Hãy sẵn sàng cho bước tiếp theo nhé.</p>

        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0; background: #fff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 60px; vertical-align: top;">
                <img src="${companyLogo || 'https://via.placeholder.com/60'}" alt="Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid #f3f4f6;">
              </td>
              <td style="padding-left: 16px; vertical-align: top;">
                <h3 style="margin: 0 0 4px 0; color: #003f87; font-size: 16px;">${jobTitle}</h3>
                <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; font-weight: bold;">${companyName}</p>
                <a href="${actionUrl || jobUrl || '#'}" style="display: inline-block; background: #0056B3; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: bold; box-shadow: 0 10px 18px rgba(0,86,179,.2);">${actionLabel || 'Xem chi tiết công việc'}</a>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

/**
 * Gửi email thông báo lời mời phỏng vấn.
 */
export const sendInterviewInvitationEmail = ({ receiverUserId, toEmail, jobseekerName, companyName, jobTitle, interviewTime, interviewType, location, note, actionUrl, actionLabel, notificationId }) => {
  const formatTime = (timeStr) => {
    if (!timeStr) return 'Sẽ được thông báo';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${h}:${m} - ${d}/${mo}/${y}`;
  };

  const subject = `VietWorks - Bạn nhận được lời mời phỏng vấn từ ${companyName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #003f87;">Lời mời phỏng vấn 🎉</h2>
        <p>Xin chào <strong>${jobseekerName || 'bạn'}</strong>,</p>
        <p>Chúc mừng! Bạn đã được <strong>${companyName}</strong> mời phỏng vấn cho vị trí <strong>${jobTitle}</strong>.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold; width:40%;">Thời gian</td><td style="padding:8px; border:1px solid #e5e7eb;">${formatTime(interviewTime)}</td></tr>
          <tr><td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Hình thức</td><td style="padding:8px; border:1px solid #e5e7eb;">${interviewType === 'ONLINE' ? 'Trực tuyến (Online)' : 'Trực tiếp (Offline)'}</td></tr>
          ${location ? `<tr><td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Địa điểm / Link</td><td style="padding:8px; border:1px solid #e5e7eb;">${location}</td></tr>` : ''}
          ${note ? `<tr><td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Ghi chú</td><td style="padding:8px; border:1px solid #e5e7eb;">${note}</td></tr>` : ''}
        </table>
        <p>Hãy đăng nhập VietWorks để xem chi tiết và chuẩn bị cho buổi phỏng vấn.</p>
        ${renderEmailActionButton(actionUrl, actionLabel || 'Xem lời mời phỏng vấn')}
        <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

/**
 * Gửi email thông báo hồ sơ bị từ chối.
 */
export const sendRejectionEmail = ({ receiverUserId, toEmail, jobseekerName, companyName, jobTitle, reason, actionUrl, actionLabel, notificationId }) => {
  const subject = `VietWorks - Cập nhật kết quả ứng tuyển tại ${companyName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #003f87;">Kết quả ứng tuyển</h2>
        <p>Xin chào <strong>${jobseekerName || 'bạn'}</strong>,</p>
        <p>Cảm ơn bạn đã ứng tuyển vào vị trí <strong>${jobTitle}</strong> tại <strong>${companyName}</strong>.</p>
        <p>Sau khi xem xét, nhà tuyển dụng xin phép thông báo rằng hồ sơ của bạn chưa phù hợp với yêu cầu lần này.</p>
        ${reason ? `<p><strong>Lý do:</strong> ${reason}</p>` : ''}
        <p>Đừng nản lòng! Hãy tiếp tục tìm kiếm cơ hội phù hợp trên VietWorks nhé.</p>
        ${renderEmailActionButton(actionUrl, actionLabel || 'Xem trạng thái hồ sơ')}
        <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

/**
 * Gửi email thông báo có tin nhắn mới.
 */
export const sendNewMessageEmail = ({ receiverUserId, toEmail, receiverName, senderName, preview, actionUrl, actionLabel, notificationId }) => {
  const subject = `VietWorks - Bạn có tin nhắn mới từ ${senderName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #003f87;">Tin nhắn mới 💬</h2>
        <p>Xin chào <strong>${receiverName || 'bạn'}</strong>,</p>
        <p><strong>${senderName}</strong> vừa gửi cho bạn một tin nhắn:</p>
        <blockquote style="border-left: 4px solid #003f87; margin: 16px 0; padding: 12px 16px; background: #fff; border-radius: 0 8px 8px 0; font-style: italic; color: #4b5563;">
          "${preview || '(Xem tin nhắn trong ứng dụng)'}"
        </blockquote>
        <p>Đăng nhập VietWorks để xem và trả lời tin nhắn.</p>
        ${renderEmailActionButton(actionUrl, actionLabel || 'Mở tin nhắn')}
        <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

/**
 * Gửi email thông báo việc làm phù hợp (Matching Jobs).
 */
export const sendMatchingJobsEmail = ({ receiverUserId, toEmail, jobseekerName, jobs = [], actionUrl, actionLabel, notificationId }) => {
  const subject = `VietWorks - Có ${jobs.length} việc làm mới phù hợp với bạn!`;
  
  const jobCardsHtml = jobs.map(job => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fff;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 60px; vertical-align: top;">
            <img src="${job.logo || 'https://via.placeholder.com/60'}" alt="Logo" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid #f3f4f6;">
          </td>
          <td style="padding-left: 16px; vertical-align: top;">
            <h3 style="margin: 0 0 4px 0; color: #003f87; font-size: 16px;">${job.title}</h3>
            <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px; font-weight: bold;">${job.companyName}</p>
            <p style="margin: 0 0 4px 0; color: #10b981; font-size: 13px;">💰 Mức lương: ${job.salary || 'Thỏa thuận'}</p>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">📍 Địa điểm: ${job.location || 'Không xác định'}</p>
            <a href="${job.jobUrl}" style="display: inline-block; background: #003f87; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: bold;">Ứng tuyển ngay</a>
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto; background: #f9fafb; padding-bottom: 24px;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #003f87; margin-top: 0;">Việc làm phù hợp dành riêng cho bạn 🎯</h2>
        <p>Xin chào <strong>${jobseekerName || 'bạn'}</strong>,</p>
        <p>Hệ thống VietWorks vừa tìm thấy <strong>${jobs.length}</strong> cơ hội việc làm mới rất phù hợp với kỹ năng và mong muốn của bạn. Đừng bỏ lỡ nhé!</p>
        
        <div style="margin-top: 24px;">
          ${jobCardsHtml}
        </div>

        ${renderEmailActionButton(actionUrl, actionLabel || 'Xem việc làm phù hợp')}
        <p style="margin-top: 24px;">Chúc bạn tìm được công việc ưng ý!</p>
        <p>Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

/**
 * Gửi email thông báo ra mắt mẫu CV mới.
 */
export const sendNewCvTemplateEmail = ({ receiverUserId, toEmail, jobseekerName, cvTemplate = {}, actionUrl, actionLabel, notificationId }) => {
  const subject = `VietWorks - Trải nghiệm mẫu CV mới: ${cvTemplate.name || 'Mẫu CV Chuyên Nghiệp'}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto; background: #f9fafb; padding-bottom: 24px;">
      <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #003f87; margin-top: 0;">Mẫu CV mới vừa ra mắt! 🚀</h2>
        <p>Xin chào <strong>${jobseekerName || 'bạn'}</strong>,</p>
        <p>VietWorks vừa cập nhật thêm một mẫu CV hoàn toàn mới giúp hồ sơ của bạn nổi bật hơn trong mắt nhà tuyển dụng.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0; background: #fff; text-align: center;">
          <img src="${cvTemplate.thumbnail || 'https://via.placeholder.com/400x250?text=CV+Template'}" alt="CV Template" style="width: 100%; max-width: 400px; border-radius: 8px; border: 1px solid #f3f4f6; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">${cvTemplate.name || 'Mẫu CV Mới'}</h3>
          <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 14px;">${cvTemplate.description || 'Thiết kế hiện đại, tinh tế, phù hợp cho nhiều ngành nghề.'}</p>
          <a href="${actionUrl || cvTemplate.templateUrl || '#'}" style="display: inline-block; background: #0056B3; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 800; box-shadow: 0 10px 18px rgba(0,86,179,.2);">${actionLabel || 'Tạo CV với mẫu này ngay'}</a>
        </div>

        <p>Truy cập VietWorks để khám phá thêm nhiều mẫu CV chuyên nghiệp khác.</p>
        <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
      </div>
    </div>
  `;
  return sendBusinessEmail({ receiverUserId, toEmail, subject, html, notificationId });
};

export const sendOtpEmail = async ({ toEmail, fullName, otpCode }) => {
  const subject = 'VietWorks - Mã xác thực email nhà tuyển dụng';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Xin chào ${fullName || 'bạn'},</h2>
      <p>Mã OTP xác thực tài khoản nhà tuyển dụng của bạn là:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otpCode}</p>
      <p>Mã có hiệu lực trong <b>1 phút</b>.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      <p>Trân trọng,<br />Đội ngũ VietWorks</p>
    </div>
  `;

  return sendHtmlEmail({ toEmail, subject, html });
};

export const sendPasswordResetEmail = async ({ toEmail, fullName, resetUrl }) => {
  const subject = 'VietWorks - Đặt lại mật khẩu';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2>Xin chào ${fullName || 'bạn'},</h2>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản VietWorks của bạn.</p>
      <p>Vui lòng bấm vào nút bên dưới để tạo mật khẩu mới:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #003f87; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
      </p>
      <p>Link này có hiệu lực trong <b>30 phút</b>.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      <p>Trân trọng,<br />Đội ngũ VietWorks</p>
    </div>
  `;

  return sendHtmlEmail({ toEmail, subject, html });
};


