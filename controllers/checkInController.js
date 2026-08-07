import Customer from "../models/schemas/customerSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";
import Location from "../models/schemas/locationSchema.js";

import {
    generateQRToken,
    verifyQRToken
} from "../services/qrService.js";

// Lấy ID phòng tập của máy quét từ tài khoản nhân viên đang đăng nhập (locationId trong token).
// Admin / tài khoản không gắn phòng tập -> null (quản lý toàn bộ).
// Tài khoản admin (isAdmin) có thể chọn phòng tập cần quản lý qua header X-Location-Id.
const getStationLocationId = (req) => {
    const u = req.user;
    const headerLoc = req.headers && req.headers['x-location-id'];
    if (u && u.isAdmin && headerLoc && headerLoc !== 'all' && headerLoc !== 'undefined') {
        return headerLoc;
    }
    return (u && u.isStaff && u.locationId) ? u.locationId : null;
};

// Kiểm tra hội viên/nhân viên có thuộc đúng phòng tập của máy quét hay không.
// Trả về true nếu bị chặn (khác phòng tập) — kèm tên phòng tập để hiện thông báo.
const resolveClubConflict = async (personLocationId, stationLocationId) => {
    if (!stationLocationId || !personLocationId) return null;
    if (String(personLocationId) === String(stationLocationId)) return null;
    const loc = await Location.findById(personLocationId);
    const clubName = loc ? (loc.title || loc.address || 'chưa rõ') : 'khác';
    return { clubName };
};

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

        // Kiểm tra phòng tập: hội viên phải thuộc đúng phòng tập của máy quét
        const stationLocationId = getStationLocationId(req);
        const conflict = await resolveClubConflict(customer.locationId, stationLocationId);
        if (conflict) {
            return res.status(403).json({
                error: `Hội viên này ở phòng tập ${conflict.clubName}`
            });
        }

        const activePackages = await UserPackage.find({
            customer_id: customer._id,
            status: "đang hoạt động",
            payment_status: "đã thanh toán",
            end_date: {
                $gte: new Date()
            }
        }).populate("package_id", "name").sort({ end_date: 1 });

        if (!activePackages || activePackages.length === 0) {
            return res.status(400).json({
                error: "Hội viên không có gói tập hợp lệ"
            });
        }

        const packagesInfo = activePackages.map(p => ({
            packageName: p.package_id?.name || "Gói tập",
            endDate: p.end_date
                ? new Date(p.end_date).toLocaleDateString("vi-VN")
                : "Chưa rõ",
            remainingDays: Math.max(0, Math.ceil((p.end_date - new Date()) / 86400000))
        }));

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

        // Ca đang mở trong ngày (chưa checkout) — nếu có thì lần quét này là CHECK-OUT
        const openCheckin = await CheckIn.findOne({
            customerId: customer._id,
            checkInTime: {
                $gte: startDay,
                $lte: endDay
            },
            checkOutTime: null
        }).sort({ checkInTime: -1 });

        if (openCheckin) {
            const checkOutAt = new Date();
            openCheckin.checkOutTime = checkOutAt;
            openCheckin.status = "checked-out";
            await openCheckin.save();

            return res.status(200).json({
                message: "Check-out thành công",
                status: "checked-out",
                customer: {
                    id: customer._id,
                    fullName: customer.fullName,
                    phone: customer.phone,
                    packageName: packagesInfo[0]?.packageName || "Gói tập",
                    endDate: packagesInfo[0]?.endDate || "Chưa rõ",
                    packages: packagesInfo
                },
                checkOutTime: checkOutAt,
                totalMinutes: Math.max(0, Math.round((checkOutAt - openCheckin.checkInTime) / 60000))
            });
        }

        // Không có ca mở -> mở ca check-in mới (nhiều lần/ngày)
        const checkin = await CheckIn.create({
            customerId: customer._id,
            staffId: req.user ? req.user.id : null,
            locationId: customer.locationId || null,
            userPackageId: activePackages[0]._id,
            qrToken: token,
            checkInTime: new Date(),
            status: "success"
        });

        return res.status(200).json({
            message: "Check-in thành công",
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone,
                packageName: packagesInfo[0]?.packageName || "Gói tập",
                endDate: packagesInfo[0]?.endDate || "Chưa rõ",
                remainingDays: packagesInfo[0]?.remainingDays || 0,
                packages: packagesInfo
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

            // Nhân viên có phòng tập -> chỉ xem điểm danh của đúng phòng tập mình
            const q = {};
            const loc = getStationLocationId(req);
            if (loc) q.locationId = loc;

            const [data, total] = await Promise.all([
                CheckIn.find(q)
                    .populate("customerId", "fullName phone")
                    .populate("staffId", "fullName")
                    .sort({ checkInTime: -1 })
                    .skip(skip)
                    .limit(limit),
                CheckIn.countDocuments(q)
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