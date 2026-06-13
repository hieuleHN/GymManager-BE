import express from "express";
import db from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors"; // 1. Bổ sung dòng import này
import authRoutes from "./routes/authRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import userPackageRoutes from "./routes/userPackageRouters.js";
import { initPackageStatusScheduler } from "./services/cronService.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/roles", roleRoutes);
app.use("/locations", locationRoutes);
app.use("/services", serviceRoutes);
// Route Gói tập
app.use("/packages", packageRoutes);
// Route Bộ môn
app.use("/departments", departmentRoutes);
app.use("/user-packages", userPackageRoutes);

initPackageStatusScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});
