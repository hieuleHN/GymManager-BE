import express from "express";
import cors from "cors";
import db from "./config/db.js";
import dotenv from "dotenv";

// ================= ROUTES ĐANG CÓ FILE (HOẠT ĐỘNG) =================
import departmentRoutes from "./routes/departmentRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";

// ================= TẠM ẨN CÁC ROUTES CHƯA CÓ FILE TRÊN GIT =================
// import authRoutes from "./routes/authRoutes.js";
// import roleRoutes from "./routes/roleRoutes.js";
// import serviceRoutes from "./routes/serviceRoutes.js";
// import userPackageRoutes from "./routes/userPackageRouters.js";
// import productRoutes from "./routes/productRoutes.js";
// import equipmentRoutes from "./routes/equipmentRoutes.js";
// import disciplineRoutes from "./routes/disciplineRoutes.js";
// import productReturnRoutes from "./routes/productReturnRoutes.js";
// import customerRoutes from "./routes/customerRoutes.js";
// import staffRoutes from "./routes/staffRoutes.js";
// import jobRoutes from "./routes/jobRoutes.js";
// import salaryRoutes from "./routes/salaryRoutes.js";
// import permissionRoutes from "./routes/permissionRoutes.js";
// import policyRoutes from "./routes/policyRoutes.js";
// import expenseRoutes from "./routes/expenseRoutes.js";
// import lockerRoutes from "./routes/lockerRoutes.js";

import { initPackageStatusScheduler } from "./services/cronService.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static("uploads"));

// ================= KÍCH HOẠT MIDDLEWARE ROUTE HỢP LỆ =================
app.use("/departments", departmentRoutes);

app.use("/locations", locationRoutes);
app.use("/api/locations", locationRoutes);

app.use("/packages", packageRoutes);
app.use("/api/packages", packageRoutes);

// ================= TẠM ẨN CÁC MIDDLEWARE CHƯA CÓ FILE =================
// app.use("/auth", authRoutes);
// app.use("/roles", roleRoutes);
// app.use("/services", serviceRoutes);
// app.use("/user-packages", userPackageRoutes);
// app.use("/products", productRoutes);
// app.use("/api/products", productRoutes);
// app.use("/equipments", equipmentRoutes);
// app.use("/api/equipments", equipmentRoutes);
// app.use("/api/disciplines", disciplineRoutes);
// app.use("/api/product-returns", productReturnRoutes);
// app.use("/api/customers", customerRoutes);
// app.use("/api/staff", staffRoutes);
// app.use("/api/jobs", jobRoutes);
// app.use("/api/salary", salaryRoutes);
// app.use("/api/permissions", permissionRoutes);
// app.use("/api/policies", policyRoutes);
// app.use("/api/expenses", expenseRoutes);
// app.use("/api/lockers", lockerRoutes);

initPackageStatusScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
