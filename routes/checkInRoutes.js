import express from "express";

import {
    generateQRCode,
    verifyQRCode,
    getCheckInHistory
} from "../controllers/checkInController.js";

import {
    authenticateToken
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
    Hội viên lấy QR Code (Bắt buộc đăng nhập)
*/
router.get(
    "/qr",
    authenticateToken,
    generateQRCode
);

/*
    Máy quét verify mã QR (Bỏ authenticateToken để máy quét tự do gửi qrToken lên)
*/
router.post(
    "/verify",
    verifyQRCode
);

/*
    Xem lịch sử check-in (Bắt buộc đăng nhập)
*/
router.get(
    "/history",
    authenticateToken,
    getCheckInHistory
);

export default router;