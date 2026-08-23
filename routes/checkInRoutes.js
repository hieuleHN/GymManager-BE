import express from "express";

import {
    generateQRCode,
    verifyQRCode,
    confirmCheckIn,
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
    Máy quét verify mã QR — có authenticateToken để xác định phòng tập hiện tại
    từ nhân viên đang đăng nhập (locationId trong token), nhằm chặn hội viên
    thuộc phòng tập khác.
*/
router.post(
    "/verify",
    authenticateToken,
    verifyQRCode
);

/*
    Xác nhận check-in chính thức sau bước verify (máy quét bấm "Xác nhận").
    Dùng token QR làm bằng chứng nên không cần đăng nhập.
*/
router.post(
    "/confirm",
    confirmCheckIn
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