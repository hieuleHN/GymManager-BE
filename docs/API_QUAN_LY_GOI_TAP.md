# API QUẢN LÝ GÓI TẬP — Tài liệu chi tiết (kết nối FE có sẵn)

Base URL: `http://localhost:5000` — Mọi request cần header `Authorization: Bearer <token>` trừ các API public.
Phân trang chuẩn toàn hệ thống: `?page=1&limit=15`, response `{ data, total, page, limit, totalPages }`.

---

## 1. Vòng đời gói: nháp → đang bán → tạm ngưng → ngừng bán

Trường mới trên Package: `lifecycle_status` (`nháp | đang bán | tạm ngưng | ngừng bán`), đồng bộ 2 chiều với cờ cũ `is_active` (chỉ "đang bán" là `is_active = true`).

**Tự ẩn khỏi trang khách:** mọi API public (`GET /api/packages`, `/api/packages/:id`, `/by-discipline/:id`, `/related`) tự động lọc chỉ trả gói **đang bán** cho khách/khách vãng lai. Staff đăng nhập (token hợp lệ) thấy **toàn bộ** trạng thái → FE admin hiện tại không cần sửa gì vẫn hoạt động.

### Đổi trạng thái
```
PATCH /api/packages/:id/lifecycle-status        (admin)
Body: { "status": "đang bán", "reason": "Mở bán mùa hè" }
```
Bảng chuyển hợp lệ:
| Từ | Cho phép chuyển sang |
|---|---|
| nháp | đang bán, ngừng bán |
| đang bán | tạm ngưng, ngừng bán |
| tạm ngưng | đang bán, ngừng bán |
| ngừng bán | đang bán |

Response: `{ message, data: { _id, name, lifecycle_status, is_active } }`
Lỗi transition: `400 { error }`. Không tìm thấy: `404`.

> Tương thích: nút "Tạm ngưng/Kích hoạt" hiện tại của `PackageList.tsx` (PUT `/api/packages/:id` body `{is_active}`) vẫn chạy và được map sang lifecycle tương ứng + ghi audit.

---

## 2. Chặn xóa gói đang có hội viên

```
DELETE /api/packages/:id       (admin)
```
- Gói **chưa từng có hội viên** (gói nháp): xóa thật → `200 { message }`.
- Gói **có lịch sử đăng ký**: chặn, trả `409` kèm gợi ý:
```json
{
  "error": "Không thể xóa gói này vì đang có 5 hội viên sở hữu! ...",
  "code": "PACKAGE_HAS_SUBSCRIBERS",
  "ownerCount": 5,
  "totalRegistrations": 12,
  "suggestion": {
    "method": "PATCH",
    "url": "/api/packages/:id/lifecycle-status",
    "body": { "status": "ngừng bán" }
  }
}
```
FE nên đọc `error`/`code` để hiện nút "Chuyển ngừng bán" thay vì xóa.

---

## 3. Số người sở hữu + danh sách ai đang dùng (phân trang, tìm kiếm)

```
GET /api/packages/:id/subscribers?page=1&limit=15&search=&status=owned   (staff)
```
- `search`: theo tên / email / SĐT / tài khoản khách.
- `status`: mặc định chỉ hội viên đang sở hữu (`đang hoạt động | còn 10 ngày | đang tạm ngưng`); truyền `all` để lấy tất cả lượt đăng ký.

Response:
```json
{
  "package": { "_id", "name", "unitPrice" },
  "ownerCount": 23,
  "total": 15, "page": 1, "limit": 15, "totalPages": 1,
  "data": [ { "_id", "customer": { fullName, email, phone, account, avatar },
              "start_date", "end_date", "remaining_days",
              "duration_months", "total_price", "status", "payment_status" } ]
}
```

Badge nhanh: `GET /api/packages/:id/owner-count` → `{ ownerCount }`.
Danh sách gói (staff view) cũng đã kèm sẵn `ownerCount` mỗi item.

---

## 4. Quy tắc giá: giá tháng gốc + bảng giảm giá → tự tính, CẤM gõ tay

Package chỉ nhận 2 trường giá: `unitPrice` (giá tháng gốc) và `durations: [{ months, discount }]`.
Công thức server: `total = round(unitPrice × months × (1 - discount/100))` (làm tròn nghìn).

- Khi tạo/sửa gói: mọi giá từng mức gửi lên từ client bị **bỏ qua**.
- Khi mua/gia hạn: `total_price` client gửi lên bị **bỏ qua**, luôn tính lại server-side.

Xem trước giá (FE gọi khi khách chọn thời hạn):
```
POST /api/packages/:id/preview-price     Body: { "months": 6 }
POST /api/packages/preview-price         Body: { "package_id": "...", "months": 6 }
→ { unit_price, months, discount_percent, total_price, has_tier_rule }
```
Bảng giá đầy đủ của gói: `GET /api/packages/:id/price-table` → `{ unit_price, rows: [{months, discount_percent, total_price}] }`

---

## 5. Lịch sử giá + áp giá theo thời điểm

Mỗi lần đổi `unitPrice`/bảng giảm giá → ghi 1 dòng tự động (cả khi tạo gói).

```
GET /api/packages/:id/price-history?page=1&limit=20      (staff)
→ { data: [ { unit_price_old, unit_price, durations_old, durations,
             reason, changed_by_name, changed_at } ], total, page, totalPages }
```
**Hợp đồng cũ giữ giá cũ:** `UserPackage` snapshot giá ngay lúc mua:
- `total_price` (giá chốt), `unit_price_applied`, `price_snapshot {unit_price, months, discount_percent}`.

---

## 6. Đơn chờ thanh toán: nhắc thanh toán + tự hủy sau 3 ngày

- **Cron tự động** (mỗi phút, đã cắm sẵn):
  - Đơn `chờ thanh toán` quá **72 giờ** → tự hủy (`payment_status` & `status` = `đã hủy`) + notification cho khách.
  - Đơn treo quá 48h → tự gửi notification nhắc thanh toán, tối đa 1 lần/24h/đơn.
- **Nhắc thủ công (admin bấm nút "Nhắc"):**
```
POST /api/user-packages/:id/payment-reminder    (staff)
→ { message, hoursLeftToCancel }
```
Lỗi nếu đơn không ở trạng thái chờ: `400`.

---

## 7. Gia hạn hộ + duyệt

Luồng: khách hết hạn → admin tạo phiếu gia hạn → **duyệt là xong** (khách không phải thao tác gì).

### 7.1. Admin tạo phiếu
```
POST /api/user-packages/admin-renew          (admin)
Body: { customerId, registrationId?, package_id?, duration_months, locationId?, note? }
```
- Bỏ trống `package_id` → tự dùng gói của hợp đồng gần nhất của khách.
- Giá tự tính theo bảng giá hiện hành; phiếu ở trạng thái `chờ xác nhận` / `chờ thanh toán`.
- Khách được nhận notification "phiếu gia hạn đã được tạo".

### 7.2. Danh sách phiếu chờ duyệt
```
GET /api/user-packages/renewal-tickets?page=1&limit=15&status=chờ xác nhận&search=
```
(`search` theo tên/SĐT/tài khoản khách)

### 7.3. Duyệt / từ chối — tái dùng API duyệt có sẵn của FE PaymentManagement
```
POST /api/user-packages/:id/approve     Body: { "action": "approve" | "reject" }
```
Khi duyệt phiếu gia hạn: server tự chốt `start_date = max(hôm nay, ngày hết hạn cũ)` (nối liền không mất ngày), tính lại `end_date`, **tự phân bổ lại buổi PT**, đánh dấu đã thanh toán tại quầy, trạng thái → `đang hoạt động`. Mọi thao tác đều ghi audit.

---

## 8. Gửi nhắc gia hạn hàng loạt

### Danh sách khách sắp hết hạn (hoặc đã hết hạn)
```
GET /api/user-packages/expiring?within_days=10&page=1&limit=15&include_expired=false&locationId=
→ { data: [ { _id, customer{...}, packageName, end_date, remaining_days,
             last_renewal_reminder_at } ], total, page, totalPages }
```

### Bấm gửi notification hàng loạt
```
POST /api/user-packages/renewal-reminders/send         (admin)
Body: { "registrationIds": ["...", "..."] }             // hoặc { "within_days": 10 } để gửi tất cả
→ { message, sent, skippedCount, skippedRegistrationIds }
```
Chống spam: mỗi hợp đồng chỉ nhận 1 thông báo / 24 giờ (`last_renewal_reminder_at`).

Notification type mới: `renewal_reminder`, `payment_reminder`, `package_cancelled`, `package_renewed` (+ field `relatedUserPackageId`).

---

## 9. Tự phân bổ buổi PT khi mua gói

Server tự sinh `monthlySessions [{ month, year, total, used }]` cho từng tháng của kỳ hạn:
- Gói thường: `total = ptSessionsPerMonth` mỗi tháng.
- Gói Full tháng: `total = 999` (quy ước không giới hạn).
Áp dụng cho: tự đăng ký, đăng ký hộ, gia hạn self-service, **duyệt phiếu gia hạn hộ**.
API xem/trừ buổi có sẵn: `GET /api/user-packages/pt-sessions`, `POST /api/user-packages/pt-sessions/deduct`.

---

## 10. Audit log — ai / làm gì / khi nào

Đã tự ghi cho: tạo/sửa/xóa gói, đổi lifecycle, đổi giá, xóa bị chặn, xuất PDF hợp đồng, duyệt/từ chối đăng ký, duyệt phiếu gia hạn, tạo phiếu gia hạn hộ, đăng ký hộ, xác nhận thanh toán, nhắc thanh toán, nhắc gia hạn hàng loạt.

```
GET /api/audit-logs?page=1&limit=20&entity_type=&action=&actor_id=&from=2026-08-01&to=2026-08-31&q=   (admin)
→ { data: [ { actor_id, actor_name, actor_role, action, entity_type, entity_id,
             entity_name, before, after, description, ip, createdAt } ], total, page, totalPages }
```
Một số `action` tiêu biểu: `PACKAGE_CREATE`, `PACKAGE_UPDATE`, `PACKAGE_DELETE`, `PACKAGE_DELETE_BLOCKED`, `PACKAGE_LIFECYCLE_CHANGE`, `PRICE_CHANGE`, `REGISTRATION_APPROVE`, `ADMIN_RENEW_CREATE`, `ADMIN_RENEW_APPROVE`, `PAYMENT_REMIND`, `RENEWAL_REMIND_BULK`, `PAYMENT_CONFIRM`.

---

## 11. Xuất hợp đồng + bảng giá theo gói để ký cho khách

```
GET /api/packages/:id/contract-pdf        → file application/pdf (inline)
```
PDF gồm: thông tin cơ sở + gói, quyền lợi, **bảng giá tự tính mọi mức thời gian**, cam kết Bên A/Bên B, điều khoản, chỗ ký hai bên (chữ ký Bên A tự lấy từ cơ sở). Gói `nháp` chỉ staff xuất được.

---

## Ghi chú tích hợp FE (không bắt buộc nhưng nên làm)

| Trang FE hiện có | Việc cần |
|---|---|
| `PackageList.tsx` | Hiện badge theo `lifecycle_status` (mới có trong response); nút Xóa nên xử lý `409 code=PACKAGE_HAS_SUBSCRIBERS` → gọi PATCH lifecycle-status; thêm chọn trạng thái `?status=` khi filter; hiển thị `ownerCount` |
| `AddPackage.tsx` / `EditPackage.tsx` | Gói mới luôn về `nháp`; thêm nút "Mở bán/Tạm ngưng/Ngừng bán" gọi `PATCH :id/lifecycle-status` |
| `ExpiredCustomers.tsx` | Đang mock → thay bằng `GET /user-packages/expiring` + `POST /user-packages/admin-renew` + `POST :id/approve` |
| `PaymentManagement.tsx` | Thêm nút "Nhắc thanh toán" → `POST /user-packages/:id/payment-reminder`; tab "Phiếu gia hạn" → `GET /user-packages/renewal-tickets` |
| `ContractList.tsx` / `EditContract.tsx` | Thêm nút "Xuất hợp đồng + bảng giá" → mở link `/api/packages/:id/contract-pdf` |
| Mọi trang mua/gia hạn gói | KHÔNG gửi `total_price` nữa — response `register`/`admin-register`/`renew-upgrade` trả kèm `pricing` để hiển thị |
