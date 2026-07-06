# Cron Jobs — Setup Guide

Spec v2.0 §12.1 quy định 2 cron jobs:

| Cron | Endpoint | Giờ chạy | Mục đích |
|---|---|---|---|
| `expire-packages` | `PATCH /api/system/cron/expire-premium-services` | 00:00 daily | Set EXPIRED cho gói hết hạn + notify |
| `notify-expiring-soon` | `PATCH /api/system/cron/notify-expiring-soon` | 09:00 daily | Nhắc user trước 3 ngày |

## Bảo mật

Cả 2 endpoint yêu cầu header `x-internal-secret: <INTERNAL_SECRET>`.  
Đặt `INTERNAL_SECRET` trong file `.env` (khác với JWT_SECRET).

## Setup với GitHub Actions

Tạo file `.github/workflows/cron-jobs.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    # 00:00 UTC = 07:00 ICT (giờ VN)
    - cron: '0 17 * * *'  # expire (chạy 17:00 UTC = 00:00 ICT ngày hôm sau)
    # 09:00 UTC = 16:00 ICT (giờ VN)
    - cron: '0 2 * * *'   # notify (chạy 02:00 UTC = 09:00 ICT)

jobs:
  expire:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 17 * * *'
    steps:
      - name: Expire Premium Services
        run: |
          curl -X PATCH "${{ secrets.API_BASE_URL }}/api/system/cron/expire-premium-services" \
               -H "x-internal-secret: ${{ secrets.INTERNAL_SECRET }}" \
               -H "Content-Type: application/json"

  notify-expiring:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 2 * * *'
    steps:
      - name: Notify Expiring Soon
        run: |
          curl -X PATCH "${{ secrets.API_BASE_URL }}/api/system/cron/notify-expiring-soon" \
               -H "x-internal-secret: ${{ secrets.INTERNAL_SECRET }}" \
               -H "Content-Type: application/json"
```

## Setup với cron-job.org (đơn giản hơn)

1. Vào https://cron-job.org, tạo 2 cron jobs:
   - **Expire**: `0 0 * * *` (00:00 daily) → PATCH URL expire
   - **Notify**: `0 9 * * *` (09:00 daily) → PATCH URL notify
2. Thêm custom header `x-internal-secret: <giá trị INTERNAL_SECRET>`
3. Method: PATCH

## Manual test (Postman / curl)

```bash
curl -X PATCH "http://localhost:5000/api/system/cron/expire-premium-services" \
     -H "x-internal-secret: test-internal-secret" \
     -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "cvBoostsExpired": 5,
    "jobBoostsExpired": 2,
    "userServicePackagesExpired": 7,
    "expiringSoonNotified": 3,
    "expiredNotified": 7,
    "executedAt": "2026-07-04T00:00:00.000Z"
  }
}
```

## Lưu ý

- Cron KHÔNG retry tự động → nếu API lỗi 1 ngày, subscriptions hết hạn sẽ bị delay expire đến ngày hôm sau
- Có thể chạy 2 cron CÙNG GIỜ để an toàn, idempotent (các updateMany đã check status nên không xử lý lại record đã EXPIRED)
- `notifyExpiringSoonOnly` chỉ gửi 1 lần/gói nhờ `metadata.notifiedExpiringSoonAt` flag