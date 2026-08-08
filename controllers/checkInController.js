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
            status: { $in: ["đang hoạt động", "còn 10 ngày"] },
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
            status: { $in: ["đang hoạt động", "còn 10 ngày"] },
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
            const limit = Math.min(parseInt(req.query.limit) || 20, 200);
            const skip = (page - 1) * limit;

            // Nhân viên có phòng tập -> chỉ xem điểm danh của đúng phòng tập mình
            const q = {};
            const loc = getStationLocationId(req);
            if (loc) q.locationId = loc;

            // Lọc theo ngày (YYYY-MM-DD) nếu có
            if (req.query.date) {
                const parts = String(req.query.date).split("-").map(Number);
                if (parts.length === 3 && parts.every(n => !isNaN(n))) {
                    const [y, m, d] = parts;
                    q.checkInTime = {
                        $gte: new Date(y, m - 1, d, 0, 0, 0, 0),
                        $lte: new Date(y, m - 1, d, 23, 59, 59, 999)
                    };
                }
            }

            const [data, total] = await Promise.all([
                CheckIn.find(q)
                    .populate("customerId",
                        "fullName phone gender email avatar address idNumber registerDate status account balance locationId createdAt")
                    .populate("staffId", "fullName")
                    .sort({ checkInTime: -1 })
                    .skip(skip)
                    .limit(limit),
                CheckIn.countDocuments(q)
            ]);

            // Gom toàn bộ gói tập của các hội viên trong trang (tránh N+1 queries)
            const customerIds = [...new Set(
                data.map(c => c.customerId?._id?.toString()).filter(Boolean)
            )];
            const pkgMap = {};
            if (customerIds.length) {
                const now = new Date();
                const curMonth = now.getMonth() + 1;
                const curYear = now.getFullYear();
                const packages = await UserPackage.find({ customer_id: { $in: customerIds } })
                    .populate("package_id", "name features ptSessionsPerMonth isFullMonth duration_days unitPrice")
                    .sort({ start_date: -1 });
                packages.forEach(p => {
                    const cid = String(p.customer_id);
                    if (!pkgMap[cid]) pkgMap[cid] = [];
                    const monthlyEntry = (p.monthlySessions || []).find(
                        m => m.month === curMonth && m.year === curYear
                    );
                    // Số buổi HLV lấy theo gói tập (package), fallback từ bản đăng ký — vì một số
                    // bản đăng ký cũ tạo qua admin không copy ptSessionsPerMonth từ gói.
                    const pkgPt = p.package_id?.ptSessionsPerMonth || 0;
                    const effPt = p.ptSessionsPerMonth || pkgPt;
                    const effFull = !!p.isFullMonth || !!p.package_id?.isFullMonth;
                    let remainingPt = 0;
                    if (effFull) {
                        remainingPt = 999;
                    } else if (effPt > 0) {
                        remainingPt = monthlyEntry
                            ? Math.max(0, monthlyEntry.total - monthlyEntry.used)
                            : effPt;
                    }
                    pkgMap[cid].push({
                        packageName: p.package_id?.name || "Gói tập",
                        startDate: p.start_date ? new Date(p.start_date).toLocaleDateString("vi-VN") : "Chưa rõ",
                        endDate: p.end_date ? new Date(p.end_date).toLocaleDateString("vi-VN") : "Chưa rõ",
                        status: p.status,
                        payment_status: p.payment_status,
                        remainingDays: p.end_date
                            ? Math.max(0, Math.ceil((p.end_date - new Date()) / 86400000))
                            : 0,
                        features: (p.package_id?.features || []).filter(Boolean),
                        ptSessionsPerMonth: effPt,
                        isFullMonth: effFull,
                        hasHLV: effPt > 0 || effFull,
                        remainingPtSessions: remainingPt,
                        totalPrice: p.total_price || 0
                    });
                });
            }

            const enriched = data.map(item => {
                const obj = item.toObject();
                const cid = obj.customerId?._id?.toString();
                const allPkgs = pkgMap[cid] || [];
                const activePkgs = allPkgs.filter(p =>
                    (p.status === "đang hoạt động" || p.status === "còn 10 ngày") &&
                    p.payment_status === "đã thanh toán" &&
                    p.remainingDays > 0
                );

                // Gộp trùng theo tên gói (giữ gói đang hoạt động, hạn dài hơn) — đồng bộ với màn điểm danh
                const dedupeByPriority = (list) => {
                    const byName = new Map();
                    list.forEach(p => {
                        const key = (p.packageName || "").trim();
                        if (!key) return;
                        const rank = (x) =>
                            (x.status === "đang hoạt động" || x.status === "còn 10 ngày") ? 0 : 1;
                        const ex = byName.get(key);
                        const exRank = ex ? rank(ex) : Infinity;
                        const curRank = rank(p);
                        if (!ex || curRank < exRank || (curRank === exRank && p.remainingDays >= ex.remainingDays)) {
                            byName.set(key, p);
                        }
                    });
                    return Array.from(byName.values());
                };

                const checkIn = new Date(obj.checkInTime);
                const checkOut = obj.checkOutTime ? new Date(obj.checkOutTime) : null;
                obj.totalMinutes = checkOut
                    ? Math.max(0, Math.round((checkOut - checkIn) / 60000))
                    : null;
                obj.packageCount = dedupeByPriority(activePkgs).length;
                // Chỉ hiển thị các gói đang hoạt động (giống dashboard/my-packages),
                // không bao gồm gói đã hủy / hết hạn / chưa thanh toán
                obj.packages = dedupeByPriority(activePkgs);
                obj.isCheckedOut = !!checkOut;
                return obj;
            });

            return res.status(200).json({
                data: enriched,
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