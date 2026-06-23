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

// So sánh chuỗi theo thời-gian-hằng-số để tránh timing attack
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

/**
 * Xác thực webhook SePay bằng chữ ký HMAC-SHA256.
 * SePay gửi header x-sepay-signature (và tùy chọn x-sepay-timestamp).
 * Thử cả 3 format ký vì SePay tùy cấu hình có thể khác nhau.
 * ⚠️ HMAC tính trên RAW body (chuỗi gốc) — KHÔNG phải JSON.stringify lại.
 * @param {string} rawBody   - body thô đúng như SePay gửi
 * @param {string} signature - header x-sepay-signature
 * @param {string} [timestamp] - header x-sepay-timestamp
 * @returns {boolean}
 */
export const verifySepayWebhook = (rawBody, signature, timestamp = '') => {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('SEPAY_WEBHOOK_SECRET chưa cấu hình - BỎ QUA xác thực (chỉ dùng dev/mô phỏng)');
    return true;
  }
  if (!signature || rawBody == null) return false;
  const h = (data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
  const candidates = [
    h(rawBody),                               // <hex>
    'sha256=' + h(rawBody),                   // sha256=<hex>
    'sha256=' + h(timestamp + '.' + rawBody)  // sha256=HMAC(timestamp + "." + body)
  ];
  return candidates.some(c => timingSafeEqualStr(c, signature));
};

/**
 * Parse webhook payload từ SePay bank transfer
 * Payload docs: https://docs.sepay.vn/webhook.html
 *
 * @param {Object} body - Request body từ SePay webhook
 * @returns {Object} Parsed data
 */
/**
 * Bóc mã đơn "SEVQR..." từ webhook.
 * Ưu tiên field `code` (nếu SePay đã tách sẵn theo cấu hình mẫu mã thanh toán),
 * nếu không có thì TỰ tìm trong nội dung chuyển khoản `content`.
 * Mã = "SEVQR" + 12 ký tự. VietinBank BẮT BUỘC nội dung CK bắt đầu bằng SEVQR.
 */
const extractOrderCode = (body) => {
  if (body.code) return String(body.code).toUpperCase();
  const content = (body.content || '').toUpperCase();
  const match = content.match(/SEVQR[A-Z0-9]{12}/);
  return match ? match[0] : null;
};

export const parseSepayWebhook = (body) => {
  return {
    // ID duy nhất của giao dịch - dùng để chống trùng lặp
    transactionId: body.id,
    // Mã đơn hàng: ưu tiên body.code, fallback bóc từ nội dung CK (body.content)
    orderCode: extractOrderCode(body),
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
 * @param {string} prefix - Prefix mã đơn (default: SEVQR — VietinBank yêu cầu)
 * @returns {string} Mã đơn hàng cho nội dung CK
 */
export const generateOrderCode = (transactionId, prefix = 'SEVQR') => {
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

/**
 * FALLBACK khi SePay miss webhook (VietinBank hay miss):
 * Hỏi thẳng API SePay xem có giao dịch nào khớp orderCode + đúng số tiền chưa.
 * @returns {{transactionId:number, amount:number, referenceCode:string|null, transactionDate:string|null}|null}
 */
export const findSepayTransactionByCode = async (orderCode, amount) => {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=20', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const { transactions = [] } = await res.json();
    const code = String(orderCode).toUpperCase();
    const m = transactions.find(t =>
      (t.transaction_content || '').toUpperCase().includes(code) &&
      Number(t.amount_in) === Number(amount)
    );
    if (!m) return null;
    return {
      transactionId: Number(m.id),
      amount: Number(m.amount_in),
      referenceCode: m.reference_number || null,
      transactionDate: m.transaction_date || null
    };
  } catch (e) {
    console.error('findSepayTransactionByCode error:', e.message);
    return null;
  }
};