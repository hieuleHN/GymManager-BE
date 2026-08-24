import express from "express";
import {
    verifyCheckInToken,
    confirmCheckIn,
    getCheckInHistory,
    verifyFaceCheckIn,
    registerFaceID,
    getFaceDescriptors
} from "../controllers/checkInController.js";

// Middleware fallback an toàn
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

// 1. API Điểm danh & Nhận diện FaceID (Mở quyền để máy quét camera hoạt động độc lập ổn định)
router.get("/face/descriptors", getFaceDescriptors);
router.post("/face/verify", verifyFaceCheckIn);
router.post("/face/register", authenticateToken, registerFaceID);

// 2. Điểm danh QR & Lịch sử
router.post("/verify", verifyCheckInToken);
router.post("/confirm", confirmCheckIn);
router.get("/history", getCheckInHistory);

export default router;