const createMailTransporter = async () => {
  const hasSmtpConfig =
    process.env.MAIL_HOST &&
    process.env.MAIL_PORT &&
    process.env.MAIL_USERNAME &&
    process.env.MAIL_PASSWORD &&
    process.env.MAIL_FROM_ADDRESS &&
    process.env.MAIL_FROM_NAME;

  if (!hasSmtpConfig) {
    throw new Error('Missing mail config (MAIL_HOST/MAIL_PORT/MAIL_USERNAME/MAIL_PASSWORD/MAIL_FROM_NAME/MAIL_FROM_ADDRESS)');
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
