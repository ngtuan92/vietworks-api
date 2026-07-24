# VietWorks — Báo cáo tổng hợp Unit Test (CẬP NHẬT LẦN CUỐI)

> **Ngày cập nhật:** 2026-07-24
> **Lệnh chạy:** `cd vietworks-api && npm test`
> **Tổng tests viết:** **371**
> **Tổng tests PASS:** **371** (100%)
> **Tổng tests FAIL:** **0**
> **Test Suites PASS nguyên suite:** 11 / 11 (100%)

## So với Excel `Group2_SE1918_Unit_Test_Case.xlsx` (386 UTCID)

- **UTCID đã cover** (có test viết): **~287 / 386** (≈74%)
- **UTCID PASS** (đúng expected status code): **~287 / 386** (≈74%) — toàn bộ UTCID đã cover nay đều PASS
- **UTCID chưa cover** (chưa có test viết, ví dụ Saved Jobs, Salary Insight): **~99 / 386**

---

## 1. Tổng quan theo Suite

| # | Test Suite | PASS | TOTAL | % | Trạng thái |
|---|---|---:|---:|---:|---|
| 1 | `enums/enumSmoke.test.js` | **7** | **7** | **100%** | ✅ |
| 2 | `controllers/authController.test.js` | **40** | **40** | **100%** | ✅ |
| 3 | `controllers/notifChat.test.js` | **16** | **16** | **100%** | ✅ |
| 4 | `controllers/talentPoolBoost.test.js` | **31** | **31** | **100%** | ✅ |
| 5 | `controllers/remainingFc.test.js` | **32** | **32** | **100%** | ✅ |
| 6 | `controllers/adminController.test.js` | **57** | **57** | **100%** | ✅ |
| 7 | `controllers/employerCompany.test.js` | **42** | **42** | **100%** | ✅ |
| 8 | `controllers/paymentWallet.test.js` | **21** | **21** | **100%** | ✅ |
| 9 | `controllers/jobApplyAts.test.js` | **58** | **58** | **100%** | ✅ |
| 10 | `controllers/jobseekerMasterData.test.js` | **19** | **19** | **100%** | ✅ |
| 11 | `controllers/cvManagement.test.js` | **48** | **48** | **100%** | ✅ |
| | **TỔNG** | **371** | **371** | **100%** | |

Xem breakdown theo từng người viết test tại **`ALL_TESTS_BY_AUTHOR.md`**.

---

## 2. Tiến độ sửa chữa qua các lần chạy

| Lần chạy | Pass | Total | Pass rate | Ghi chú |
|---|---:|---:|---:|---|
| Ban đầu (test.md ảo) | 0 | 0 | — | Không có file test |
| Sau lần viết đầu tiên | 287 | 367 | 78% | Áp dụng chainable + write tests |
| Sau chainable mkChainable | 296 | 373 | 79% | Refactor talentPoolBoost → 31/31 |
| Sau fix mock chain + reject pattern | 306 | 371 | 82.5% | Sửa syntax lỗi trong mockImplementation |
| **Sau rà soát + sửa toàn bộ 65 fail còn lại** | **371** | **371** | **100%** | Xem mục 3 |

---

## 3. Các dạng lỗi đã tìm ra và sửa (65 test fail ban đầu + phát sinh thêm)

Không phải tất cả đều là "mock chain thiếu" như đợt báo cáo trước — rà lại kỹ hơn cho thấy nhiều lỗi thực sự nằm ở **test gọi sai tham số / sai method / sai function** so với controller thật, khiến controller luôn rơi vào cùng một nhánh (thường là 400 do `mongoose.Types.ObjectId.isValid()` fail) bất kể kịch bản test muốn kiểm tra. Các dạng lỗi chính:

1. **ID giả không đúng định dạng ObjectId** (`'cv1'`, `'a1'`, `'x'`...) — nhiều controller validate `mongoose.Types.ObjectId.isValid(req.params.id)` trước tiên; ID ngắn không hợp lệ luôn cho 400, che mất nhánh thật sự cần test. → Thay bằng ObjectId hợp lệ 24 hex char (`507f1f77bcf86cd799439011`).
2. **Sai tên param** — ví dụ controller đọc `req.params.jobId`/`req.params.companyId` nhưng test truyền `req.params.id`; hoặc field body `rejectedReason` bị test gọi là `reason`. → khớp lại đúng tên field.
3. **Sai method Mongoose được mock** — test mock `Model.findById` nhưng controller thật gọi `Model.findOne(...)`/`.findOneAndUpdate`/`.aggregate`; hoặc mock `.lean()` trong khi controller không gọi `.lean()` mà await thẳng sau `.populate()`/`.sort()`. → khớp lại đúng method + đúng độ sâu chain.
4. **`chainableModel` cục bộ bị lỗi không cache mock** (`cvManagement.test.js`, `talentPoolBoost.test.js`) — Proxy tạo `jest.fn()` mới mỗi lần truy cập property thay vì tái sử dụng, khiến `mockReturnChain(model.findOne, data)` cấu hình một jest.fn() khác hoàn toàn với cái controller thực sự gọi → dữ liệu mock không bao giờ tới được controller. → thay bằng `chainableModel` dùng chung từ `test-utils.js` (có cache theo method).
5. **Alias import sai** (`talentPoolBoost.test.js`) — `mockResponse as mr` bị dùng để build request giả, khiến `req.user`/`req.params` luôn `undefined` cho mọi test dùng `employerReq`/`jobseekerReq` trong file. → sửa lại `mockRequest as mr`.
6. **Gọi nhầm function** — ví dụ test "Reject Application"/"Apply Job" ATS gọi đúng controller nhưng dùng dữ liệu mock cho một luồng nghiệp vụ khác (VD: `Cv.findOne` bị bỏ quên khiến `applyJob` luôn trả "CV không tồn tại"); hoặc test "Invoice" gọi `getInvoiceRequests` (danh sách hóa đơn cho admin, đụng model `Invoice` thật chưa mock → treo 5s timeout) thay vì `requestInvoice` (API đã bị vô hiệu hóa, luôn trả 410).
7. **1 lỗi nghiệp vụ thật trong code** đã sửa kèm theo: `deleteJobLevel` (masterDataController.js) không kiểm tra kết quả `findByIdAndUpdate` trước khi trả 200 — sửa thêm check `!updated → 404`, khớp với pattern `deleteCareerGroup` đã làm đúng.

Chi tiết từng file đã sửa: `jobApplyAts.test.js`, `adminController.test.js`, `employerCompany.test.js`, `paymentWallet.test.js`, `jobseekerMasterData.test.js`, `remainingFc.test.js`, `cvManagement.test.js`, `talentPoolBoost.test.js`, và helper dùng chung `helpers/test-utils.js` (thêm `exists`, `insertMany`, `updateOne` vào danh sách method được cache).

---

## 4. Cấu trúc file test

```
vietworks-api/__tests__/
├── helpers/
│   └── test-utils.js              ← mockResponse, mockRequest, chain, mkChainable, chainableModel
├── enums/
│   └── enumSmoke.test.js          ✅ 7/7
└── controllers/
    ├── authController.test.js     ✅ 40/40
    ├── talentPoolBoost.test.js    ✅ 31/31
    ├── notifChat.test.js          ✅ 16/16
    ├── remainingFc.test.js        ✅ 32/32
    ├── adminController.test.js    ✅ 57/57
    ├── employerCompany.test.js    ✅ 42/42
    ├── paymentWallet.test.js      ✅ 21/21
    ├── jobApplyAts.test.js        ✅ 58/58
    ├── jobseekerMasterData.test.js ✅ 19/19
    └── cvManagement.test.js       ✅ 48/48
```

Tổng cộng **11 file test, 371 test case, 100% PASS**.

---

## 5. Pattern chuẩn để viết/sửa test cho controller (đúc kết)

```js
// 1. Dùng chainableModel dùng chung, KHÔNG tự định nghĩa lại trong từng file test:
import { mockResponse, mockRequest, chain, mkChainable, chainableModel } from '../helpers/test-utils.js';

// 2. Trước khi mock, đọc lại đúng controller thật: nó gọi Model.find hay findOne?
//    Có .lean() không? Bao nhiêu tầng .populate()? Params tên gì (id/jobId/companyId...)?
mockReturnChain(model.findOne, { _id: '507f1f77bcf86cd799439011', userId: 'u1' });

// 3. "db error" tests: reject đúng tại bước cuối cùng của chain thật
//    (nếu controller không gọi .lean(), đừng reject ở .lean() — reject ngay ở method cuối)
model.findOne.mockReturnValueOnce({ populate: () => Promise.reject(new Error('db')) });

// 4. ID trong req.params/body luôn dùng ObjectId hợp lệ (24 hex char), trừ khi test
//    CHỦ ĐÍCH kiểm tra "ID sai định dạng":
const validId = '507f1f77bcf86cd799439011';
```

---

## 6. Cách chạy

```powershell
cd D:\WDP\vietworks-api
npm test                              # chạy tất cả
npm test -- --testPathPattern=authController
npm test -- --testPathPattern=cvManagement
npm test -- --verbose                 # xem tên từng UTCID PASS/FAIL
```

---

## 7. Đánh giá tổng thể

| Chỉ số | Giá trị |
|---|---:|
| **Test Suites PASS nguyên** | 11 / 11 (100%) |
| **Tests PASS** | 371 / 371 (100%) |
| **UTCID từ Excel đã cover** | ~287 / 386 (74%) |
| **UTCID PASS** (trong số đã cover) | 100% |

**Kết luận:** Toàn bộ 371 test đã viết đều PASS. Phần việc còn lại (nếu muốn tăng coverage so với Excel) là viết thêm UTCID cho các module chưa có test — đáng chú ý nhất là **Saved Jobs** và **Salary Insight** (2 module hoàn toàn chưa có UTCID nào trong Excel lẫn code test).
