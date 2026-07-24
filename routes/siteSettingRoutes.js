import express from "express";
import {
  getHomepageSettings,
  updateHomepageSettings,
} from "../controllers/siteSettingController.js";

const router = express.Router();

// 1. GET /api/settings/homepage
// Lấy dữ liệu để hiển thị ra trang chủ (API này Public, ai vào web cũng xem được)
router.get("/homepage", getHomepageSettings);

// 2. PUT /api/settings/homepage
// Cập nhật dữ liệu từ trang Admin
router.put("/homepage", updateHomepageSettings);

export default router;
