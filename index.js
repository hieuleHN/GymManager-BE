import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import db from "./config/db.js";
import { initSocket } from "./config/socket.js";
import locationRoutes from "./routes/locationRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import { initPackageStatusScheduler } from "./services/cronService.js";
import messageMonitorRoutes from "./routes/messageMonitorRoutes.js";
import sensitiveKeywordRoutes from "./routes/sensitiveKeywordRoutes.js";
import { startEquipmentCron } from "./cronjobs/equipmentCron.js";
import { startCustomerExpiryCron } from "./cronjobs/customerExpiryCron.js";

import userPackageRoutes from "./routes/userPackageRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import equipmentRoutes from "./routes/equipmentRoutes.js";
import disciplineRoutes from "./routes/disciplineRoutes.js";
import productReturnRoutes from "./routes/productReturnRoutes.js";
import recruitmentRoutes from "./routes/recruitmentRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import lockerRoutes from "./routes/lockerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import checkInRoutes from "./routes/checkInRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import staffShiftRoutes from "./routes/staffShiftRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import statisticsRoutes from "./routes/statisticsRoutes.js";
import packageAnalyticsRoutes from "./routes/packageAnalyticsRoutes.js";
import staffWalletRoutes from "./routes/staffWalletRoutes.js";
import staffAttendanceRoutes from "./routes/staffAttendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import articleRoutes from "./routes/articleRoutes.js";
import lockerManagementRoutes from "./routes/lockerManagementRoutes.js";
import ttsRoutes from "./routes/ttsRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import serviceRequestRoutes from "./routes/serviceRequestRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";

import { autoCancelPendingBookings } from "./jobs/autoCancelBooking.js";
import { autoCancelPendingPackages } from "./jobs/autoCancelPendingPackages.js";
import { migratePackageLifecycleStatus } from "./services/startupMigrations.js";

// Khai báo route cấu hình trang chủ mới thêm
import siteSettingRoutes from "./routes/siteSettingRoutes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static("uploads"));

// Chống crash do lỗi bất đồng bộ nền (cron job, callback...) - log ra thay vì thoát process
process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught exception:", err);
});

// Routes
app.use("/locations", locationRoutes);
app.use("/api/locations", locationRoutes);
app.use("/packages", packageRoutes);

app.use("/api/recruitments", recruitmentRoutes);

app.use("/products", productRoutes);
app.use("/api/products", productRoutes);
app.use("/equipments", equipmentRoutes);
app.use("/api/equipments", equipmentRoutes);
app.use("/api/disciplines", disciplineRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/product-returns", productReturnRoutes);

app.use("/api/customers", customerRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/lockers", lockerRoutes);

app.use("/api/user-packages", userPackageRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/checkin", checkInRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/staff-shifts", staffShiftRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/articles", articleRoutes);

app.use("/api/statistics", statisticsRoutes);
app.use("/api/package-analytics", packageAnalyticsRoutes);
app.use("/api/staff-wallet", staffWalletRoutes);
app.use("/api/staff-attendance", staffAttendanceRoutes);

// Cắm route cấu hình trang chủ vào hệ thống
app.use("/api/settings", siteSettingRoutes);

// Quản lý tủ đồ (sơ đồ tủ, gán/trả tủ) - trước đây nằm trong module v2
app.use("/api/v2/lockers", lockerManagementRoutes);

// Giọng đọc tiếng Việt miễn phí
app.use("/api/tts", ttsRoutes);

// Chat nội bộ / HLV - Hội viên / Lễ tân - Hội viên
app.use("/api/messages", messageRoutes);

// Giám sát tin nhắn (admin/quản lý) + quản lý từ khoá nhạy cảm
app.use("/api/messages-monitor", messageMonitorRoutes);
app.use("/api/sensitive-keywords", sensitiveKeywordRoutes);

// Yêu cầu dịch vụ từ hội viên
app.use("/api/service-requests", serviceRequestRoutes);

// Audit log: nhật ký mọi thao tác quản trị (ai/làm gì/khi nào)
app.use("/api/audit-logs", auditLogRoutes);

initPackageStatusScheduler();
startEquipmentCron();
startCustomerExpiryCron();

// Chạy sau khi MongoDB đã kết nối thành công
setTimeout(async () => {
  try {
    console.log(
      "[Startup] Đang xử lý dữ liệu cũ + giao dịch chờ thanh toán quá hạn...",
    );
    await migratePackageLifecycleStatus();
    await autoCancelPendingBookings();
    await autoCancelPendingPackages();
  } catch (err) {
    console.error("[Startup] Lỗi:", err.message);
  }
}, 5000);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
