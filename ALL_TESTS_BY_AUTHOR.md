# VietWorks API — Kết quả Unit Test theo từng người (đối chiếu Excel Group2_SE1918_Unit_Test_Case.xlsx)

> Nguồn: chạy thực tế `npm test` trong `vietworks-api` (Jest) ngày 2026-07-24, đối chiếu tên describe block với cột "Created By" trong file Excel gốc.


**Tổng: 371/371 test PASS (100.0%)**

| Người viết | PASS | Tổng | % |
|---|---:|---:|---:|
| DungCN | 38 | 38 | 100% |
| TuanND | 69 | 69 | 100% |
| DungNT | 66 | 66 | 100% |
| ThaiDV | 116 | 116 | 100% |
| NamNH | 75 | 75 | 100% |
| Infra | 7 | 7 | 100% |

## DungCN — 38/38 test PASS

### ✅ Application Status Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns application status (1 ms) | PASS |
| UTCID02: A - not found (1 ms) | PASS |
| UTCID03: A - wrong user returns 403 (1 ms) | PASS |

### ✅ Applied Job List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns applications (2 ms) | PASS |
| UTCID02: A - empty applications (1 ms) | PASS |

### ✅ Apply Job (7/7)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path applies successfully (5 ms) | PASS |
| UTCID02: A - duplicate application returns 400 | PASS |
| UTCID03: A - job not published returns 400 | PASS |
| UTCID04: A - missing CV returns 400 | PASS |
| UTCID05: A - agreement not accepted returns 400 (1 ms) | PASS |
| UTCID06: B - job with multiple locations (4 ms) | PASS |
| UTCID07: A - db error returns 500 (1 ms) | PASS |

### ✅ Apply Options (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns CV options (1 ms) | PASS |
| UTCID02: A - no CVs (1 ms) | PASS |

### ✅ Company List Public (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns company list (1 ms) | PASS |
| UTCID02: A - empty list | PASS |
| UTCID03: A - db error (1 ms) | PASS |

### ✅ Job Preference Update (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - updates preferences | PASS |
| UTCID02: A - db error | PASS |

### ✅ Job Search Suggestion (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns suggestions (1 ms) | PASS |
| UTCID02: B - empty q returns 200 | PASS |

### ✅ Jobseeker Profile Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns 200 with profile + skills (9 ms) | PASS |
| UTCID02: A - user not found returns 404 | PASS |
| UTCID03: A - wrong role returns 403 | PASS |

### ✅ Jobseeker Profile Update (8/8)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path updates fullName + phone (1 ms) | PASS |
| UTCID02: A - empty fullName returns 400 (1 ms) | PASS |
| UTCID03: A - wrong role returns 403 (1 ms) | PASS |
| UTCID04: A - DB error returns 500 (1 ms) | PASS |
| UTCID05: A - missing phone triggers notification | PASS |
| UTCID06: N - avatarUrl update persists (1 ms) | PASS |
| UTCID07: B - phone validation - non-numeric (1 ms) | PASS |
| UTCID08: B - boundary empty avatar URL | PASS |

### ✅ Privacy Setting Update (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - true → PUBLIC + 200 (10 ms) | PASS |
| UTCID02: A - invalid value returns 400 (4 ms) | PASS |

### ✅ Upload CV (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path uploads PDF (453 ms) | PASS |
| UTCID02: N - happy path via files array (1 ms) | PASS |
| UTCID03: A - no file returns 400 (1 ms) | PASS |
| UTCID04: B - unsupported type returns 400 (3 ms) | PASS |


## TuanND — 69/69 test PASS

### ✅ AI CV Review (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - reviews CV (1 ms) | PASS |
| UTCID02: A - quota exceeded returns 400/429 | PASS |
| UTCID03: A - CV not extracted returns 400 | PASS |
| UTCID04: A - db error returns 500 (4 ms) | PASS |
| UTCID05: N - returns review history (1 ms) | PASS |

### ✅ AI Review Detail (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns review detail (1 ms) | PASS |
| UTCID02: A - not found returns 404 | PASS |
| UTCID03: A - wrong user returns 403/404 (1 ms) | PASS |
| UTCID04: A - db error returns 500 (2 ms) | PASS |

### ✅ AI Review History (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns multi-item history | PASS |
| UTCID02: B - empty history returns 200 | PASS |
| UTCID03: A - db error returns 500 (2 ms) | PASS |

### ✅ Active CV Template List + CV Template Preview (gộp chung trong file test) (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - public template list (1 ms) | PASS |
| UTCID02: A - empty template list | PASS |
| UTCID03: N - preview template | PASS |
| UTCID04: A - template not found returns 404 (1 ms) | PASS |
| UTCID05: A - db error returns 500 (4 ms) | PASS |

### ✅ Authentication and Authorization (11/11)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path generates token (21 ms) | PASS |
| UTCID02: A - missing userId throws (1 ms) | PASS |
| UTCID03: A - null userId handles gracefully (1 ms) | PASS |
| UTCID04: N - valid bearer token attaches user (3 ms) | PASS |
| UTCID05: A - missing Authorization header returns 401 (1 ms) | PASS |
| UTCID06: A - invalid token returns 401 (1 ms) | PASS |
| UTCID07: A - expired token returns 401 (1 ms) | PASS |
| UTCID08: A - user not found returns 401 (8 ms) | PASS |
| UTCID09: A - BANNED account returns 403 (2 ms) | PASS |
| UTCID10: A - role mismatch returns 403 (1 ms) | PASS |
| UTCID11: B - empty bearer token (1 ms) | PASS |

### ✅ CV Delete (7/7)

| Test | Kết quả |
|---|---|
| UTCID01: N - deletes built cv | PASS |
| UTCID02: N - deletes uploaded cv | PASS |
| UTCID03: A - delete not found (1 ms) | PASS |
| UTCID04: A - delete wrong user returns 403/404 | PASS |
| UTCID05: A - db error returns 500 (4 ms) | PASS |
| UTCID06: B - delete returns null (1 ms) | PASS |
| UTCID07: A - delete uploaded wrong user returns 403/404 | PASS |

### ✅ CV List (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns user cvs | PASS |
| UTCID02: A - empty list | PASS |
| UTCID03: A - db error (6 ms) | PASS |

### ✅ CV Preview (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - preview uploaded CV (2739 ms) | PASS |
| UTCID02: N - preview built CV (1 ms) | PASS |
| UTCID03: A - not found (1 ms) | PASS |
| UTCID04: A - not owner returns 403/404 | PASS |

### ✅ CV Update (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path updates CV content (2 ms) | PASS |
| UTCID02: A - wrong user returns 403/404 (1 ms) | PASS |
| UTCID03: A - missing id returns 400/404 | PASS |
| UTCID04: B - empty body (1 ms) | PASS |
| UTCID05: A - db error returns 500 (5 ms) | PASS |

### ✅ Create CV from Template (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path creates cv (1 ms) | PASS |
| UTCID02: A - missing templateId returns 400 | PASS |
| UTCID03: A - template inactive returns 400/404 | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |
| UTCID05: N - returns CV preview | PASS |

### ✅ Login (9/9)

| Test | Kết quả |
|---|---|
| UTCID01: N — happy path jobseeker returns 200 + tokens (1 ms) | PASS |
| UTCID02: A — wrong password returns 401 | PASS |
| UTCID03: A — user not found returns 401 | PASS |
| UTCID04: A — BANNED account returns 403 (1 ms) | PASS |
| UTCID05: N — loginEmployer matching role succeeds | PASS |
| UTCID06: A — loginEmployer rejects jobseeker with 403 | PASS |
| UTCID07: A — UNVERIFIED employer returns 403 | PASS |
| UTCID08: A — missing email/password returns 400 (1 ms) | PASS |
| UTCID09-12: A — database error returns 500 | PASS |

### ✅ Logout (1/1)

| Test | Kết quả |
|---|---|
| N — sets expired refresh-token cookie and returns 200 (3 ms) | PASS |

### ✅ Register Jobseeker (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N — happy path returns 201 and creates user/wallet/profile (7 ms) | PASS |
| UTCID02: A — email already registered returns 400 (1 ms) | PASS |
| UTCID03: A — weak password returns 400 (1 ms) | PASS |
| UTCID04: A — Mongo server error returns 500 and rolls back created docs (2 ms) | PASS |

### ✅ Uploaded CV Rename (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path renames uploaded cv | PASS |
| UTCID02: A - empty title returns 400 (1 ms) | PASS |
| UTCID03: A - cv not owned returns 400/404 | PASS |


## DungNT — 66/66 test PASS

### ✅ Application CV Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns detail (1 ms) | PASS |
| UTCID02: A - not found | PASS |
| UTCID03: A - not owner | PASS |

### ✅ Application List By Job (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - lists applications (1 ms) | PASS |
| UTCID02: A - job not owned | PASS |
| UTCID03: A - job not found | PASS |

### ✅ Approve Application (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path approves (1 ms) | PASS |
| UTCID02: A - already approved | PASS |
| UTCID03: A - not owner returns 403 | PASS |
| UTCID04: A - db error returns 500 | PASS |

### ✅ Change Password (6/6)

| Test | Kết quả |
|---|---|
| UTCID01: N — happy path: returns 200 and persists new hash (1 ms) | PASS |
| UTCID02: A — wrong current password returns 400 (1 ms) | PASS |
| UTCID03: A — short new password returns 400 | PASS |
| UTCID04: A — confirm password missing returns 400 | PASS |
| UTCID05: A — user not found returns 404 (1 ms) | PASS |
| UTCID06: A — save error returns 500 | PASS |

### ✅ Chat with User (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - sends text message in existing conversation (1 ms) | PASS |
| UTCID02: N - creates new conversation (1 ms) | PASS |
| UTCID03: A - missing content returns 400 | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |
| UTCID05: B - very long message | PASS |

### ✅ Forgot Password (7/7)

| Test | Kết quả |
|---|---|
| UTCID01: N — happy path sends reset email + 200 (2 ms) | PASS |
| UTCID02: A — empty email returns 400 | PASS |
| UTCID03: A — null email returns 400 | PASS |
| UTCID04: A — invalid email format returns 400 | PASS |
| UTCID05: A — not-found email still returns generic 200 (1 ms) | PASS |
| UTCID06: A — non-LOCAL authProvider returns generic 200 | PASS |
| UTCID07: A — email service throws returns 500 | PASS |

### ✅ Interview Invitation Create (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path creates invitation | PASS |
| UTCID02: A - missing schedule returns 400 (1 ms) | PASS |
| UTCID03: A - not owner returns 403 | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |

### ✅ Mark Application As Viewed (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path marks VIEWED (1 ms) | PASS |
| UTCID02: A - already viewed | PASS |
| UTCID03: A - not owner returns 403 | PASS |
| UTCID04: B - boundary: null app returns 400/404 | PASS |

### ✅ Notification List (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns notifications (9 ms) | PASS |
| UTCID02: A - empty list (1 ms) | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |
| UTCID04: B - pagination boundary (1 ms) | PASS |

### ✅ Notification Mark All As Read (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - marks all as read (1 ms) | PASS |
| UTCID02: A - db error returns 500 (1 ms) | PASS |

### ✅ Notification Mark As Read (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - marks one as read (1 ms) | PASS |
| UTCID02: A - not owner returns 403/404 | PASS |

### ✅ Register and Verify Employer Account (phần Register) (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N — happy path 201 + OTP email sent (2 ms) | PASS |
| UTCID02: A — missing required field returns 400 (1 ms) | PASS |
| UTCID03: A — empty company name returns 400 | PASS |
| UTCID04: A — existing user returns 400 (1 ms) | PASS |
| UTCID05: A — server error returns 500 + rolls back docs (42 ms) | PASS |

### ✅ Register and Verify Employer Account (phần Verify/Resend OTP) (8/8)

| Test | Kết quả |
|---|---|
| UTCID06: N — verify correct OTP marks account ACTIVE (2 ms) | PASS |
| UTCID07: A — wrong OTP returns 400 | PASS |
| UTCID08: A — empty OTP returns 400 (1 ms) | PASS |
| UTCID09: A — user not found returns 400 | PASS |
| UTCID10: A — expired OTP returns 400 (1 ms) | PASS |
| UTCID11: N — resend OTP for unverified user (1 ms) | PASS |
| UTCID12: B — cooldown 30s returns 429 | PASS |
| UTCID13: A — already ACTIVE returns 400 (1 ms) | PASS |

### ✅ Reject Application (6/6)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path rejects | PASS |
| UTCID02: A - missing reason returns 400 (1 ms) | PASS |
| UTCID03: A - already rejected | PASS |
| UTCID04: A - not owner returns 403 | PASS |
| UTCID05: A - db error returns 500 (1 ms) | PASS |
| UTCID06: B - very long reason | PASS |

### ✅ View Conversations (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns conversations (1 ms) | PASS |
| UTCID02: N - empty list | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |


## ThaiDV — 116/116 test PASS

### ✅ Add Company Location (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path creates location (1 ms) | PASS |
| UTCID02: A - missing address returns 400 (2 ms) | PASS |
| UTCID03: A - employer without company returns 400/404 (1 ms) | PASS |

### ✅ Admin Master Data Create (6/6)

| Test | Kết quả |
|---|---|
| UTCID01: N - creates career group | PASS |
| UTCID02: A - missing name returns 400 (3 ms) | PASS |
| UTCID03: A - duplicate slug returns 400 (1 ms) | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |
| UTCID05: N - creates job level (1 ms) | PASS |
| UTCID06: B - empty fields (67 ms) | PASS |

### ✅ Admin Master Data Deactivate (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - deactivates job level (1 ms) | PASS |
| UTCID02: A - not found (1 ms) | PASS |
| UTCID03: A - db error returns 500 | PASS |

### ✅ Admin Master Data Update (6/6)

| Test | Kết quả |
|---|---|
| UTCID01: N - updates career group (1 ms) | PASS |
| UTCID02: A - not found (1 ms) | PASS |
| UTCID03: A - empty body (1 ms) | PASS |
| UTCID04: N - updates job level | PASS |
| UTCID05: N - soft-delete job level (1 ms) | PASS |
| UTCID06: B - empty query (3 ms) | PASS |

### ✅ Company Approval (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path approves (1 ms) | PASS |
| UTCID02: A - not pending returns 400 | PASS |
| UTCID03: A - company not found returns 404 | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |
| UTCID05: A - concurrent state change returns 400 | PASS |

### ✅ Company Document Upload (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path uploads PDF | PASS |
| UTCID02: A - missing file returns 400 | PASS |
| UTCID03: B - unsupported format (1 ms) | PASS |

### ✅ Company Profile Detail (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (1 ms) | PASS |
| UTCID02: A - company not found returns 404 (1 ms) | PASS |
| UTCID03: A - employer has no company returns 400 (1 ms) | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |

### ✅ Company Profile Update (11/11)

| Test | Kết quả |
|---|---|
| UTCID01: N - updates company info happy path (2 ms) | PASS |
| UTCID02: A - missing required name returns 400 (1 ms) | PASS |
| UTCID03: A - empty company name returns 400 (1 ms) | PASS |
| UTCID04: A - taxCode duplicate returns 400 (1 ms) | PASS |
| UTCID05: N - upload branding images (1 ms) | PASS |
| UTCID06: A - missing branding files (1 ms) | PASS |
| UTCID07: A - unsupported file format (2 ms) | PASS |
| UTCID08: N - update industry (1 ms) | PASS |
| UTCID09: A - invalid industry id (1 ms) | PASS |
| UTCID10: A - db error during update (1 ms) | PASS |
| UTCID11: B - empty body update (1 ms) | PASS |

### ✅ Company Rejection (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path rejects | PASS |
| UTCID02: A - missing reason returns 400 | PASS |
| UTCID03: A - not pending returns 400 | PASS |
| UTCID04: A - not found returns 404 | PASS |
| UTCID05: A - db error returns 500 (1 ms) | PASS |

### ✅ Company Submit For Verification (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (1 ms) | PASS |
| UTCID02: A - missing license returns 400 (1 ms) | PASS |
| UTCID03: A - incomplete profile returns 400 (1 ms) | PASS |
| UTCID04: A - already verified returns 400 | PASS |
| UTCID05: A - DB error returns 500 (1 ms) | PASS |

### ✅ Company Verification Detail (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (1 ms) | PASS |
| UTCID02: A - invalid id returns 400/404 | PASS |
| UTCID03: A - not found returns 404 (1 ms) | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |

### ✅ Company Verification List (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns pending companies (1 ms) | PASS |
| UTCID02: A - empty returns 200 (1 ms) | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |
| UTCID04: B - empty list boundary | PASS |

### ✅ Delete Company Location (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path deletes non-primary (1 ms) | PASS |
| UTCID02: A - primary returns 400 (1 ms) | PASS |
| UTCID03: A - not found returns 404 | PASS |

### ✅ Employer Account Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (8 ms) | PASS |
| UTCID02: A - profile not found (1 ms) | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |

### ✅ Employer Representative Update (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path updates info (1 ms) | PASS |
| UTCID02: A - empty name returns 400 (1 ms) | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |

### ✅ Job Approval (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - approves pending job (1 ms) | PASS |
| UTCID02: A - already published (4 ms) | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |

### ✅ Job Approval Detail (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns job detail (1 ms) | PASS |
| UTCID02: A - invalid id returns 400/404 (1 ms) | PASS |
| UTCID03: A - not found (1 ms) | PASS |
| UTCID04: A - db error returns 500 (1 ms) | PASS |

### ✅ Job Approval List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns pending jobs (9 ms) | PASS |
| UTCID02: B - empty list (6 ms) | PASS |

### ✅ Job Close (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path closes job (1 ms) | PASS |
| UTCID02: A - not owner returns 403 | PASS |
| UTCID03: A - already closed returns 400 (1 ms) | PASS |
| UTCID04: A - not found returns 404 | PASS |

### ✅ Job Rejection (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - rejects pending job (3 ms) | PASS |
| UTCID02: A - missing reason returns 400 (2 ms) | PASS |
| UTCID03: A - not pending (1 ms) | PASS |
| UTCID04: A - not found | PASS |
| UTCID05: A - db error returns 500 (1 ms) | PASS |

### ✅ Job Save Draft (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path creates DRAFT job (6 ms) | PASS |
| UTCID02: A - missing title returns 400 | PASS |
| UTCID03: A - wrong role returns 403 (1 ms) | PASS |
| UTCID04: A - company not verified returns 403 | PASS |
| UTCID05: A - db error returns 500 (38 ms) | PASS |

### ✅ Job Submit For Approval (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path submits for approval (1 ms) | PASS |
| UTCID02: A - past deadline returns 400 | PASS |
| UTCID03: A - not owner returns 403 (1 ms) | PASS |
| UTCID04: A - already published returns 400 | PASS |

### ✅ Job Update (6/6)

| Test | Kết quả |
|---|---|
| UTCID01: N - update non-critical field (9 ms) | PASS |
| UTCID02: N - update salary reverts to PENDING_APPROVAL (11 ms) | PASS |
| UTCID03: A - not owner returns 403 (10 ms) | PASS |
| UTCID04: A - job not found returns 404 | PASS |
| UTCID05: B - empty body update (10 ms) | PASS |
| UTCID06: A - db error returns 500 (9 ms) | PASS |

### ✅ Master Experience List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - controller exists and returns data (1 ms) | PASS |
| UTCID02: A - controller may not exist | PASS |

### ✅ Master Industry List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns active industry list (1 ms) | PASS |
| UTCID02: A - DB error returns 500 | PASS |

### ✅ Master Job Level List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns active job levels (1 ms) | PASS |
| UTCID02: A - DB error returns 500 (1 ms) | PASS |

### ✅ Public Job Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (1 ms) | PASS |
| UTCID02: A - not found returns 404 | PASS |
| UTCID03: A - db error returns 500 (1 ms) | PASS |

### ✅ Public Job Search (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (2 ms) | PASS |
| UTCID02: A - empty keyword returns 200 (1 ms) | PASS |
| UTCID03: A - db error returns 500 | PASS |

### ✅ Update Company Location (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns 200 (1 ms) | PASS |
| UTCID02: A - location not found returns 404 (1 ms) | PASS |
| UTCID03: A - empty address returns 400 (1 ms) | PASS |


## NamNH — 75/75 test PASS

### ✅ Admin Package List (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns all packages (1 ms) | PASS |
| UTCID02: A - empty (1 ms) | PASS |
| UTCID03: A - db error (1 ms) | PASS |
| UTCID04: N - returns package detail | PASS |

### ✅ Admin Revenue Report (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns revenue report (1 ms) | PASS |
| UTCID02: A - missing date range (1 ms) | PASS |
| UTCID03: A - db error (1 ms) | PASS |

### ✅ Admin System Analytics (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns analytics (5 ms) | PASS |
| UTCID02: A - db error (1 ms) | PASS |

### ✅ Admin Transaction List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns all transactions (3 ms) | PASS |
| UTCID02: A - db error (1 ms) | PASS |

### ✅ Admin User List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns users (4 ms) | PASS |
| UTCID02: B - empty list (1 ms) | PASS |

### ✅ CV Boost Activation (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - activates boost | PASS |
| UTCID02: A - transaction not success returns 400 | PASS |
| UTCID03: A - tx not found returns 404 | PASS |
| UTCID04: A - db error returns 500 | PASS |

### ✅ Candidate CV Unlock (5/5)

| Test | Kết quả |
|---|---|
| UTCID01: N - unlocks candidate (7 ms) | PASS |
| UTCID02: A - already unlocked (2 ms) | PASS |
| UTCID03: A - candidate not found (1 ms) | PASS |
| UTCID04: A - db error (1 ms) | PASS |
| UTCID05: N - returns unlocked list | PASS |

### ✅ Candidate Profile Preview (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns masked profile (40 ms) | PASS |
| UTCID02: A - private profile returns 403 (12 ms) | PASS |
| UTCID03: A - not found (9 ms) | PASS |
| UTCID04: A - db error returns 500 (8 ms) | PASS |

### ✅ Employer Boost Job Payment (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - creates boost payment (2 ms) | PASS |
| UTCID02: A - job not owned returns 403 | PASS |
| UTCID03: A - deadline issue | PASS |

### ✅ Employer Transaction List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns transactions (5 ms) | PASS |
| UTCID02: A - db error returns 500 (1 ms) | PASS |

### ✅ Employer Wallet Deposit (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path creates transaction (76 ms) | PASS |
| UTCID02: A - invalid amount returns 400 (1 ms) | PASS |
| UTCID03: A - db error returns 500 (9 ms) | PASS |

### ✅ Employer Wallet Detail (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy path returns wallet (16 ms) | PASS |
| UTCID02: A - no wallet found (2 ms) | PASS |
| UTCID03: A - db error (1 ms) | PASS |

### ✅ Invoice (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns invoice for successful transaction (271 ms) | PASS |
| UTCID02: A - transaction not found (1 ms) | PASS |
| UTCID03: A - db error | PASS |

### ✅ Job Boost Activation (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - activates job boost (1 ms) | PASS |
| UTCID02: A - already exists returns 400 | PASS |
| UTCID03: A - tx not success returns 400 | PASS |

### ✅ Jobseeker Boost CV Payment (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - creates boost payment | PASS |
| UTCID02: A - insufficient balance returns 400 (1 ms) | PASS |
| UTCID03: A - missing packageId returns 400 | PASS |
| UTCID04: A - package not found returns 400/404 (1 ms) | PASS |

### ✅ Jobseeker Transaction List (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns jobseeker transactions (1 ms) | PASS |
| UTCID02: A - db error (1 ms) | PASS |

### ✅ Package Create + Package Update + Package Status Update (gộp chung trong file test) (15/15)

| Test | Kết quả |
|---|---|
| UTCID01: N - creates package | PASS |
| UTCID02: A - missing code (1 ms) | PASS |
| UTCID03: A - duplicate code (1 ms) | PASS |
| UTCID04: A - db error (14 ms) | PASS |
| UTCID05: N - updates package (1 ms) | PASS |
| UTCID06: A - not found | PASS |
| UTCID07: A - db error update (1 ms) | PASS |
| UTCID08: N - activates package (1 ms) | PASS |
| UTCID09: N - deactivates | PASS |
| UTCID10: A - invalid status (1 ms) | PASS |
| UTCID11: A - not found status | PASS |
| UTCID12: A - db error status (1 ms) | PASS |
| UTCID13: B - empty status (1 ms) | PASS |
| UTCID14: B - very long status (1 ms) | PASS |
| UTCID15: A - update package not found | PASS |

### ✅ Package List Public (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns packages (2 ms) | PASS |
| UTCID02: A - db error returns 500 (1 ms) | PASS |

### ✅ Payment Notification (2/2)

| Test | Kết quả |
|---|---|
| UTCID01: N - sends deposit success notification | PASS |
| UTCID02: A - missing recipient | PASS |

### ✅ SePay Webhook (4/4)

| Test | Kết quả |
|---|---|
| UTCID01: N - happy webhook returns 200 (3 ms) | PASS |
| UTCID02: A - invalid signature returns 200 (1 ms) | PASS |
| UTCID03: A - malformed body returns 200 | PASS |
| UTCID04: B - duplicate webhook (1 ms) | PASS |

### ✅ Talent Pool Search (3/3)

| Test | Kết quả |
|---|---|
| UTCID01: N - returns candidates (6 ms) | PASS |
| UTCID02: A - empty results (1 ms) | PASS |
| UTCID03: A - db error (1 ms) | PASS |


## Infra — 7/7 test PASS

### ✅ Enum sanity checks (không thuộc 386 UTCID trong Excel) (7/7)

| Test | Kết quả |
|---|---|
| all enum files export at least one object (9 ms) | PASS |
| every enum value is unique within its own object (6 ms) | PASS |
| JobStatus enum exists and has expected business values (1 ms) | PASS |
| UserRole enum exposes the three required roles (1 ms) | PASS |
| AccountStatus enum has UNVERIFIED, ACTIVE, BANNED | PASS |
| TransactionType has wallet, package and refund entries (2 ms) | PASS |
| CommonStatus.ACTIVE and INACTIVE are defined (1 ms) | PASS |
