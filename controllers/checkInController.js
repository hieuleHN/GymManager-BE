import Customer from "../models/schemas/customerSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";

import {
    generateQRToken,
    verifyQRToken
} from "../services/qrService.js";

export const generateQRCode = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id);

        if (!customer) {
            return res.status(404).json({
                error: "Không tìm thấy hội viên"
            });
        }

        const activePackage = await UserPackage.findOne({
            customer_id: customer._id,
            status: "đang hoạt động",
            payment_status: "đã thanh toán",
            end_date: {
                $gte: new Date()
            }
        });

        if (!activePackage) {
            return res.status(400).json({
                error: "Bạn không có gói tập còn hiệu lực"
            });
        }

        const token = generateQRToken(customer._id);

        return res.status(200).json({
            message: "Tạo QR thành công",
            token,
            expiredIn: 30
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};

export const verifyQRCode = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                error: "QR Token không tồn tại"
            });
        }

        let decoded;
        try {
            decoded = verifyQRToken(token);
        } catch {
            return res.status(400).json({
                error: "QR đã hết hạn hoặc không hợp lệ"
            });
        }

        const customer = await Customer.findById(decoded.customerId);

        if (!customer) {
            return res.status(404).json({
                error: "Không tìm thấy hội viên"
            });
        }

        const activePackage = await UserPackage.findOne({
            customer_id: customer._id,
            status: "đang hoạt động",
            payment_status: "đã thanh toán",
            end_date: {
                $gte: new Date()
            }
        });

        if (!activePackage) {
            return res.status(400).json({
                error: "Hội viên không có gói tập hợp lệ"
            });
        }

        const today = new Date();
        const startDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            0, 0, 0
        );
        const endDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23, 59, 59
        );

        const existedCheckin = await CheckIn.findOne({
            customerId: customer._id,
            checkInTime: {
                $gte: startDay,
                $lte: endDay
            }
        });

        if (existedCheckin) {
            return res.status(400).json({
                error: "Hội viên đã check-in hôm nay"
            });
        }

        const checkin = await CheckIn.create({
            customerId: customer._id,
            staffId: req.user ? req.user.id : null,
            userPackageId: activePackage._id,
            qrToken: token,
            checkInTime: new Date(),
            status: "success"
        });

        return res.status(200).json({
            message: "Check-in thành công",
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone
            },
            checkin
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};

/*
    Hàm lấy lịch sử check-in (Đồng bộ thông minh cho cả Admin và Hội Viên)
*/
export const getCheckInHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        // Kiểm tra xem tài khoản đang gọi API là Customer hay Staff
        const isCustomer = await Customer.exists({ _id: userId });

        if (isCustomer) {
            // Trường hợp 1: Nếu là HỘI VIÊN đăng nhập -> Chỉ lấy lịch sử của chính hội viên này
            const history = await CheckIn.find({ customerId: userId })
                .sort({ checkInTime: -1 });

            return res.status(200).json(history);
        } else {
            // Trường hợp 2: Nếu là ADMIN/NHÂN VIÊN đăng nhập -> Lấy toàn bộ danh sách điểm danh phân trang
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                CheckIn.find()
                    .populate("customerId", "fullName phone")
                    .populate("staffId", "fullName")
                    .sort({ checkInTime: -1 })
                    .skip(skip)
                    .limit(limit),
                CheckIn.countDocuments()
            ]);

            return res.status(200).json({
                data,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        }
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};