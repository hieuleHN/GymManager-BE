# Tài Liệu Hướng Dẫn Hệ Thống Quản Lý Tủ Đồ & Hội Viên V2

## 🎯 Giới thiệu
Phiên bản V2 bổ sung tính năng quản lý tủ đồ thông minh (Locker Management) và liên kết chặt chẽ với hồ sơ khách hàng (Customer Management).

## 🛠️ Cấu trúc thư mục V2
- `v2/models/`: Định nghĩa Mongoose Schemas cho `LockerV2` và `CustomerV2`.
- `v2/controllers/`: Xử lý logic nghiệp vụ tính toán trạng thái tủ đồ và định dạng thông tin hội viên.
- `v2/routes/`: Khai báo các API Endpoints cho phiên bản V2.
- `v2/services/`: Dịch vụ tự động hóa gán tủ đồ và tính toán thống kê.

## 🚀 Hướng dẫn tích hợp Frontend
1. Import các module giao diện tại `src/app/pages/v2/`.
2. Sử dụng `LockerAssignModalV2` để thực hiện gán tủ đồ cho hội viên.
3. Xuất dữ liệu báo cáo nhanh bằng `ExportCustomerReportV2`.