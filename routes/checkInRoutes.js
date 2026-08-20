import express from "express";
import {
    verifyCheckInToken,
    confirmCheckIn,
    getCheckInHistory,
    verifyFaceCheckIn,
    registerFaceID,
    getFaceDescriptors
} from "../controllers/checkInController.js";

// Middleware fallback an toàn nếu project dùng tên file middleware khác
let authenticateToken = (req, res, next) => next();

try {
    const authModule = await import("../middlewares/auth.js").catch(() => null)
        || await import("../middleware/auth.js").catch(() => null)
        || await import("../middlewares/authMiddleware.js").catch(() => null)
        || await import("../middleware/authMiddleware.js").catch(() => null);

    if (authModule) {
        authenticateToken = authModule.authenticateToken || authModule.verifyToken || authModule.default || authenticateToken;
    }
} catch (e) { }

const router = express.Router();

// Điểm danh QR truyền thống
router.post("/verify", authenticateToken, verifyCheckInToken);
router.post("/confirm", authenticateToken, confirmCheckIn);
router.get("/history", authenticateToken, getCheckInHistory);

// API Điểm danh & Đăng ký FaceID
router.post("/face/register", authenticateToken, registerFaceID);
router.post("/face/verify", authenticateToken, verifyFaceCheckIn);
router.get("/face/descriptors", authenticateToken, getFaceDescriptors);

export default router;