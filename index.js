import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./config/db.js";
import locationRoutes from "./routes/locationRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import { initPackageStatusScheduler } from "./services/cronService.js";

import productRoutes from "./routes/productRoutes.js";
import equipmentRoutes from "./routes/equipmentRoutes.js";
import disciplineRoutes from "./routes/disciplineRoutes.js";
import productReturnRoutes from "./routes/productReturnRoutes.js";
import recruitmentRoutes from "./routes/recruitmentRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import lockerRoutes from "./routes/lockerRoutes.js";
import userPackageRoutes from "./routes/userPackageRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import checkInRoutes from "./routes/checkInRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import staffShiftRoutes from "./routes/staffShiftRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import articleRoutes from "./routes/articleRoutes.js";

import { autoCancelPendingBookings } from "./jobs/autoCancelBooking.js";
import { autoCancelPendingPackages } from "./jobs/autoCancelPendingPackages.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static("uploads"));

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
app.use("/api/salary", salaryRoutes);
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


initPackageStatusScheduler();

// Chạy sau khi MongoDB đã kết nối thành công
setTimeout(async () => {
  try {
    console.log('[Startup] Đang xử lý các giao dịch chờ thanh toán quá hạn...');
    await autoCancelPendingBookings();
    await autoCancelPendingPackages();
  } catch (err) {
    console.error('[Startup] Lỗi:', err.message);
  }
}, 5000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
