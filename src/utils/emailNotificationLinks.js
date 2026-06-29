const getClientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

export const getEmailNotificationTarget = (typeCode, metadata = {}, receiverRole) => {
  const clientUrl = getClientUrl();

  switch (typeCode) {
    case 'EMPLOYER_VIEWED_CV':
    case 'INTERVIEW_INVITATION':
    case 'APPLICATION_RESULT':
      return metadata.applicationId
        ? { url: `${clientUrl}/applied-jobs/${metadata.applicationId}/status`, label: 'Xem trạng thái hồ sơ' }
        : { url: `${clientUrl}/applied-jobs`, label: 'Xem việc đã ứng tuyển' };

    case 'MATCHING_JOB':
      if (metadata.jobs?.[0]?.jobId) {
        return { url: `${clientUrl}/jobs/${metadata.jobs[0].jobId}`, label: 'Xem việc làm phù hợp' };
      }
      return { url: `${clientUrl}/matched-jobs`, label: 'Xem việc làm phù hợp' };

    case 'NEW_CV_TEMPLATE':
      return metadata.templateId
        ? { url: `${clientUrl}/cv-templates/gallery?templateId=${metadata.templateId}`, label: 'Xem mẫu CV mới' }
        : { url: `${clientUrl}/cv-templates/gallery`, label: 'Khám phá mẫu CV' };

    case 'NEW_APPLICATION':
      if (metadata.applicationId) {
        return { url: `${clientUrl}/employer/applications/${metadata.applicationId}`, label: 'Xem hồ sơ ứng tuyển' };
      }
      if (metadata.jobId) {
        return { url: `${clientUrl}/employer/jobs/${metadata.jobId}/applications`, label: 'Xem danh sách hồ sơ' };
      }
      return { url: `${clientUrl}/employer/candidates`, label: 'Vào ATS ứng viên' };

    case 'JOB_APPROVED':
    case 'JOB_REJECTED':
    case 'JOB_BANNED':
      if (metadata.jobId) {
        return { url: `${clientUrl}/employer/jobs/${metadata.jobId}/applications`, label: 'Xem tin tuyển dụng' };
      }
      return { url: `${clientUrl}/employer/jobs`, label: 'Quản lý tin tuyển dụng' };

    case 'COMPANY_VERIFIED':
    case 'COMPANY_REJECTED':
      return { url: `${clientUrl}/employer/company-profile`, label: 'Xem hồ sơ công ty' };

    case 'NEW_MESSAGE':
      if (receiverRole === 'EMPLOYER') {
        const query = metadata.conversationId ? `?conversationId=${metadata.conversationId}` : '';
        return { url: `${clientUrl}/employer/messages${query}`, label: 'Mở tin nhắn' };
      }
      return { url: `${clientUrl}/`, label: 'Mở VietWorks để xem tin nhắn' };

    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
    case 'PAYMENT_CANCELLED':
    case 'PACKAGE_PURCHASE_SUCCESS':
      return receiverRole === 'EMPLOYER'
        ? { url: `${clientUrl}/employer/transactions`, label: 'Xem giao dịch' }
        : { url: `${clientUrl}/premium`, label: 'Xem gói dịch vụ' };

    case 'SYSTEM_UPDATE':
      if (metadata.actionUrl) return { url: clientUrl + metadata.actionUrl, label: 'Xem chi tiết' };
      return receiverRole === 'EMPLOYER'
        ? { url: `${clientUrl}/employer/notifications`, label: 'Xem thông báo' }
        : { url: `${clientUrl}/`, label: 'Trang chủ' };

    default:
      if (metadata.actionUrl) return { url: clientUrl + metadata.actionUrl, label: 'Xem chi tiết' };
      return receiverRole === 'EMPLOYER'
        ? { url: `${clientUrl}/employer/notifications`, label: 'Xem chi tiết trên VietWorks' }
        : { url: `${clientUrl}/`, label: 'Truy cập VietWorks' };
  }
};
