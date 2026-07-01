import crypto from 'crypto';

// ============================================================
// SePay Bank Transfer - Webhook Service
// ============================================================

export const createQRPaymentUrl = ({ account, bank, amount, orderCode }) => {
  const params = new URLSearchParams({
    acc: account,
    bank,
    amount: amount.toString(),
    des: orderCode,
  });
  return `https://qr.sepay.vn/img?${params}`;
};

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

const normalizeMoney = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  return Number(cleaned || 0);
};

const getTransactionContent = (transaction = {}) => {
  return String(
    transaction.transaction_content ||
    transaction.content ||
    transaction.description ||
    transaction.transferContent ||
    transaction.code ||
    ''
  );
};

export const verifySepayWebhook = (rawBody, signature, timestamp = '') => {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('SEPAY_WEBHOOK_SECRET chưa cấu hình - bỏ qua xác thực chữ ký trong môi trường dev.');
    return true;
  }
  if (!signature || rawBody == null) return false;
  const h = (data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
  const candidates = [
    h(rawBody),
    `sha256=${h(rawBody)}`,
    `sha256=${h(`${timestamp}.${rawBody}`)}`,
  ];
  return candidates.some((candidate) => timingSafeEqualStr(candidate, signature));
};

const extractOrderCode = (body = {}) => {
  if (body.code && String(body.code).toUpperCase().startsWith('SEVQR')) {
    return String(body.code).toUpperCase();
  }

  const content = [
    body.content,
    body.transaction_content,
    body.description,
    body.transferContent,
  ].filter(Boolean).join(' ').toUpperCase();

  const match = content.match(/SEVQR[A-Z0-9]{12}/);
  return match ? match[0] : null;
};

export const parseSepayWebhook = (body = {}) => {
  return {
    transactionId: body.id,
    orderCode: extractOrderCode(body),
    amount: normalizeMoney(body.transferAmount ?? body.amount_in ?? body.amount),
    transferType: body.transferType,
    transactionDate: body.transactionDate,
    gateway: body.gateway,
    accountNumber: body.accountNumber,
    subAccount: body.subAccount || '',
    content: body.content,
    referenceCode: body.referenceCode,
    accumulated: normalizeMoney(body.accumulated),
  };
};

export const generateOrderCode = (transactionId, prefix = 'SEVQR') => {
  const cleanId = transactionId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-12);
  return `${prefix}${cleanId}`;
};

export const buildTransferContent = (orderCode) => `${orderCode} chuyen tien`;

export const findSepayTransactionByCode = async (orderCode, amount) => {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) {
    console.warn('SEPAY_API_TOKEN chưa cấu hình nên không thể polling SePay.');
    return null;
  }

  try {
    const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error('SePay polling thất bại:', response.status, response.statusText);
      return null;
    }

    const payload = await response.json();
    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
    const code = String(orderCode).toUpperCase();
    const expectedAmount = normalizeMoney(amount);

    const matched = transactions.find((transaction) => {
      const content = getTransactionContent(transaction).toUpperCase();
      const amountIn = normalizeMoney(transaction.amount_in ?? transaction.transferAmount ?? transaction.amount);
      return content.includes(code) && amountIn === expectedAmount;
    });

    if (!matched) return null;

    return {
      transactionId: matched.id ? Number(matched.id) : null,
      amount: normalizeMoney(matched.amount_in ?? matched.transferAmount ?? matched.amount),
      referenceCode: matched.reference_number || matched.referenceCode || null,
      transactionDate: matched.transaction_date || matched.transactionDate || null,
    };
  } catch (error) {
    console.error('findSepayTransactionByCode error:', error.message);
    return null;
  }
};
