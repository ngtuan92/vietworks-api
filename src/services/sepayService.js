import crypto from 'crypto';

// ============================================================
// SePay Bank Transfer - Webhook Service
// Ref: https://docs.sepay.vn/webhook.html
// ============================================================

/**
 * Tạo URL QR thanh toán SePay
 * @param {Object} params
 * @param {string} params.account - Số tài khoản ngân hàng
 * @param {string} params.bank - Tên ngân hàng (VD: Vietcombank)
 * @param {number} params.amount - Số tiền VND
 * @param {string} params.orderCode - Mã đơn hàng để trích xuất từ nội dung CK
 * @returns {string} URL QR image
 */
export const createQRPaymentUrl = ({ account, bank, amount, orderCode }) => {
  const params = new URLSearchParams({
    acc: account,
    bank: bank,
    amount: amount.toString(),
    des: orderCode
  });
  return `https://qr.sepay.vn/img?${params}`;
};

/**
 * Verify HMAC-SHA256 signature từ SePay webhook
 * @param {Object} payload - Request body từ SePay
 * @param {string} signature - Header x-sepay-signature
 * @returns {boolean}
 */
export const verifySepayWebhook = (payload, signature) => {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('SEPAY_WEBHOOK_SECRET not configured - skipping verification');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
};

/**
 * Parse webhook payload từ SePay bank transfer
 * Payload docs: https://docs.sepay.vn/webhook.html
 *
 * @param {Object} body - Request body từ SePay webhook
 * @returns {Object} Parsed data
 */
export const parseSepayWebhook = (body) => {
  return {
    // ID duy nhất của giao dịch - dùng để chống trùng lặp
    transactionId: body.id,
    // Mã đơn hàng trích xuất từ nội dung CK (VD: SEVN63DC8E5C)
    orderCode: body.code,
    // Số tiền VND
    amount: body.transferAmount,
    // "in" = tiền vào, "out" = tiền ra
    transferType: body.transferType,
    // Ngày giao dịch
    transactionDate: body.transactionDate,
    // Tên ngân hàng
    gateway: body.gateway,
    // Số tài khoản người nhận
    accountNumber: body.accountNumber,
    // Tài khoản ảo (VA) - rỗng nếu không dùng
    subAccount: body.subAccount || '',
    // Nội dung chuyển khoản đầy đủ
    content: body.content,
    // Mã reference từ ngân hàng
    referenceCode: body.referenceCode,
    // Số dư tích lũy
    accumulated: body.accumulated
  };
};

/**
 * Tạo mã đơn hàng để gắn vào nội dung CK
 * Format: {PREFIX}{ORDER_ID}
 *
 * @param {string} transactionId - MongoDB ObjectId hoặc custom ID
 * @param {string} prefix - Prefix mã đơn (default: SEVN)
 * @returns {string} Mã đơn hàng cho nội dung CK
 */
export const generateOrderCode = (transactionId, prefix = 'SEVN') => {
  const cleanId = transactionId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-12);
  return `${prefix}${cleanId}`;
};

/**
 * Build nội dung chuyển khoản mẫu để hiển thị cho khách
 *
 * @param {string} orderCode - Mã đơn hàng
 * @returns {string} Nội dung CK mẫu
 */
export const buildTransferContent = (orderCode) => {
  return `${orderCode} chuyen tien`;
};