// services/paymentNotificationService.js
// Hook thông báo tập trung cho mọi sự kiện liên quan thanh toán / gói dịch vụ:
//  - Thanh toán thành công (nạp ví / mua gói)
//  - Thanh toán thất bại / bị hủy
//  - Gói sắp hết hạn (3 ngày trước)
//  - Gói đã hết hạn
//
// Tất cả hàm đều fail-soft (lỗi chỉ log, không throw ra ngoài) để tránh
// vỡ luồng thanh toán chính khi notification service gặp sự cố.

import { createNotification } from './notificationService.js';
import { NotificationTypeCode, NotificationChannel } from '../enums/notificationEnums.js';

const safe = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.error('[paymentNotificationService] lỗi khi tạo notification:', err.message);
    return null;
  }
};

const formatVND = (n) => Number(n || 0).toLocaleString('vi-VN');

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('vi-VN');
};

/**
 * Gọi khi SePay webhook xác nhận thanh toán thành công giao dịch NẠP VÍ.
 */
export const notifyWalletDepositSuccess = async ({ userId, transaction }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.WALLET_DEPOSIT_SUCCESS,
    title: 'Nạp tiền ví thành công',
    content: `Bạn đã nạp thành công ${formatVND(transaction.amount)} VND vào ví.`,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      transactionId: transaction._id?.toString?.() ?? String(transaction._id),
      orderCode: transaction.metadata?.orderCode,
      amount: transaction.amount
    }
  }));
};

/**
 * Gọi khi SePay webhook xác nhận mua gói thành công (PACKAGE_PURCHASE).
 */
export const notifyPackagePurchaseSuccess = async ({ userId, transaction, pkg, endAt }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.PACKAGE_PURCHASE_SUCCESS,
    title: 'Mua gói dịch vụ thành công',
    content: `Bạn đã kích hoạt gói "${pkg?.name || transaction.packageCode}" thành công. Hạn sử dụng đến ${formatDate(endAt)}.`,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      transactionId: transaction._id?.toString?.() ?? String(transaction._id),
      orderCode: transaction.metadata?.orderCode,
      packageId: transaction.packageId?.toString?.() ?? String(transaction.packageId),
      packageName: pkg?.name,
      amount: transaction.amount,
      expiredAt: endAt
    }
  }));
};

/**
 * Gọi khi giao dịch chuyển sang FAILED (admin set, hoặc lệch số tiền từ webhook).
 */
export const notifyPaymentFailed = async ({ userId, transaction, reason }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.PAYMENT_FAILED,
    title: 'Thanh toán thất bại',
    content: `Giao dịch ${formatVND(transaction.amount)} VND không thành công${reason ? `: ${reason}` : '.'} Vui lòng thử lại hoặc liên hệ hỗ trợ.`,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      transactionId: transaction._id?.toString?.() ?? String(transaction._id),
      orderCode: transaction.metadata?.orderCode,
      amount: transaction.amount,
      reason: reason || null
    }
  }));
};

/**
 * Gọi khi giao dịch bị hủy (user nâng cấp gói → huỷ gói cũ,
 * hoặc admin cancel PENDING transaction quá hạn).
 */
export const notifyPaymentCancelled = async ({ userId, transaction, reason }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.PAYMENT_CANCELLED,
    title: 'Giao dịch đã bị hủy',
    content: `Giao dịch ${formatVND(transaction.amount)} VND đã được hủy${reason ? `: ${reason}` : '.'}`,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      transactionId: transaction._id?.toString?.() ?? String(transaction._id),
      orderCode: transaction.metadata?.orderCode,
      amount: transaction.amount,
      reason: reason || null
    }
  }));
};

/**
 * Thông báo gói sắp hết hạn. `channels` để tách kênh:
 *   - In-app  → gọi khi user đăng nhập phiên đầu tiên trong ngày (channels: [IN_APP])
 *   - Email   → gọi từ cron 09:00 trong 2 ngày cuối (channels: [EMAIL])
 * Mặc định gửi cả 2 kênh (giữ tương thích code cũ).
 */
export const notifyPackageExpiringSoon = async ({ userId, subscription, pkg, daysLeft, channels }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.PACKAGE_EXPIRING_SOON,
    title: 'Gói dịch vụ sắp hết hạn',
    content: `Gói "${pkg?.name || subscription.packageSnapshot?.name || subscription.packageCode}" của bạn sẽ hết hạn trong ${daysLeft} ngày (${formatDate(subscription.expiredAt)}). Vui lòng mua gói mới khi gói hiện tại kết thúc để không bị gián đoạn dịch vụ.`,
    channels: channels || [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    metadata: {
      subscriptionId: subscription._id?.toString?.() ?? String(subscription._id),
      packageId: subscription.packageId?.toString?.() ?? String(subscription.packageId),
      packageName: pkg?.name || subscription.packageSnapshot?.name || subscription.packageCode,
      targetType: subscription.targetType,
      targetId: subscription.targetId?.toString?.() ?? String(subscription.targetId || ''),
      expiredAt: subscription.expiredAt,
      daysLeft
    }
  }));
};

/**
 * Gọi từ cron job sau khi subscription bị chuyển sang EXPIRED.
 */
export const notifyPackageExpired = async ({ userId, subscription, pkg }) => {
  return safe(() => createNotification({
    receiverUserId: userId,
    typeCode: NotificationTypeCode.PACKAGE_EXPIRED,
    title: 'Gói dịch vụ đã hết hạn',
    content: `Gói "${pkg?.name || subscription.packageSnapshot?.name || subscription.packageCode}" của bạn đã hết hạn vào ${formatDate(subscription.expiredAt)}. Mua gói mới để tiếp tục sử dụng dịch vụ.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    metadata: {
      subscriptionId: subscription._id?.toString?.() ?? String(subscription._id),
      packageId: subscription.packageId?.toString?.() ?? String(subscription.packageId),
      packageName: pkg?.name || subscription.packageSnapshot?.name || subscription.packageCode,
      targetType: subscription.targetType,
      targetId: subscription.targetId?.toString?.() ?? String(subscription.targetId || ''),
      expiredAt: subscription.expiredAt
    }
  }));
};

const PaymentNotificationService = {
  notifyWalletDepositSuccess,
  notifyPackagePurchaseSuccess,
  notifyPaymentFailed,
  notifyPaymentCancelled,
  notifyPackageExpiringSoon,
  notifyPackageExpired
};

export default PaymentNotificationService;