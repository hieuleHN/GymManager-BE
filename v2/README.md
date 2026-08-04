# 🎯 GymManager-BE v2 — Kế hoạch 10 chức năng

Backend v2 viết lại sạch hơn từ v1: **Node.js + Express + MongoDB (Mongoose)**.
Mục tiêu: mỗi chức năng đi đủ 4 lớp (Model → Service → Controller → Route), validation chặt chẽ, không đụng FE.

---

## ✅ Điều kiện bắt buộc (từ trước giờ)

1. **CHỈ được code trong folder v2 của BE và FE. KHÔNG được sửa bất kỳ file nào bên ngoài** `GymManager-BE/v2/` và `GymManager-FE/src/app/pages/v2/` (kể cả file cũ của v1, config, package.json, .env... đều không đụng tới).
2. **Stack cố định**: Node.js + Express + MongoDB/Mongoose. KHÔNG đổi stack.
3. **Kiến trúc MVC 4 lớp**, đúng thứ tự:
   `models` (schema Mongoose) → `services` (business logic) → `controllers` (nhận request, gọi service, trả response) → `routes` (khai báo endpoint).
   - Business logic KHÔNG để trong controller, KHÔNG viết query trong route.
4. **Controller giữ pattern callback** `callback(null, result)` / `callback(err)` để tương thích v1.
5. **Validation dữ liệu đầu vào bắt buộc**:
   - Số điện thoại: đúng định dạng VN (ví dụ `^0\d{9,10}$`).
   - Mã tủ đồ chuẩn `LK?-\d{3,4}` (vd `L-001`, `LK001`).
   - Mọi trường enum phải nằm trong danh sách cho phép, sai thì từ chối.
6. **Enum trạng thái dùng UPPERCASE** kèm label tiếng Việt:
   - Membership: `ACTIVE` / `EXPIRING_SOON` / `EXPIRED` / `CANCELLED`
   - Payment: `PENDING` / `PAID` / `CANCELLED`
   - Locker: `AVAILABLE` / `OCCUPIED` / `MAINTENANCE` / `RESERVED`
7. **Trạng thái gói hội viên tính tự động theo thời gian**: `ACTIVE` → `EXPIRING_SOON` (≤ 10 ngày còn lại) → `EXPIRED`.
8. **Tên model v2 thêm hậu tố `V2`** (CustomerV2, LockerV2, PackageV2, UserPackageV2...) để không xung đột collection của v1.
9. **Comment và ghi chú bằng tiếng Việt**.
10. **Sửa code không làm hỏng chức năng cũ** — sau mỗi thay đổi phải chạy thử được server + endpoint liên quan.

---

## 📋 Danh sách 10 chức năng

| # | Chức năng | Module (routes) | Trạng thái |
|---|-----------|-----------------|-----------|
| 1 | Quản lý tủ đồ | `/api/v2/lockers` | ✅ đã khai báo |
| 2 | Quản lý khách hàng | `/api/v2/customers` | ✅ đã khai báo |
| 3 | Quản lý nhân viên | `/api/v2/staff` | ✅ đã khai báo |
| 4 | Quản lý sản phẩm | `/api/v2/products` | ✅ đã khai báo |
| 5 | Quản lý gói tập | `/api/v2/packages` | ✅ đã khai báo |
| 6 | Quản lý gói hội viên (Membership) | `/api/v2/user-packages` | ✅ đã khai báo |
| 7 | Điểm danh | `/api/v2/attendance` | ✅ đã khai báo |
| 8 | Đặt lịch tập / PT | `/api/v2/bookings` | ✅ đã khai báo |
| 9 | Quản lý thiết bị | `/api/v2/equipment` | ✅ đã khai báo |
| 10 | Thống kê / Dashboard | `/api/v2/dashboard` | ⏳ controller có sẵn, chưa mount vào index |

> Ghi chú: cũng đã có `controllers/expenseController.js` (chi phí) — nếu cần thay Dashboard thì đổi sang chi phí.

---

## 🧱 Cấu trúc file v2

> **Phạm vi được phép code**: `GymManager-BE/v2/` (backend) và `GymManager-FE/src/app/pages/v2/` (frontend). Mọi code v2 đều nằm gọn trong 2 folder này.

```
v2/
├── index.js              # Tổng hợp & mount tất cả routes (prefix /api/v2)
├── models/               # Mongoose schema (đặt tên XxxV2)
├── services/             # Business logic + helper (validate, tính trạng thái, thống kê)
├── controllers/          # Nhận request, gọi service, trả JSON (pattern callback)
└── routes/               # Khai báo endpoint HTTP
```

### Quy ước khi thêm chức năng mới
1. Viết `models/xxxModel.js` (schema + enum + virtuals + label tiếng Việt).
2. Viết `services/xxxService.js` (logic, validation, helper).
3. Viết `controllers/xxxController.js` (middleware/route handler, callback pattern).
4. Viết `routes/xxxRoutes.js` rồi mount vào `v2/index.js`.
5. Chạy thử server + test endpoint bằng Postman/Browser.

---

## 🚀 Chạy thử

```bash
npm install        # ở thư mục GymManager-BE
npm run dev        # server chạy tại http://localhost:5000
# Kiểm tra: GET http://localhost:5000/api/v2/health-check
```

---
