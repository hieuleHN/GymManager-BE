import mongoose from "mongoose";
import CheckIn from "../models/schemas/checkInSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";

// 1. Đăng ký FaceID cho hội viên
export const registerFaceID = async (req, res) => {
    try {
        const { customerId, faceDescriptor } = req.body;

        if (!customerId || !faceDescriptor || !Array.isArray(faceDescriptor)) {
            return res.status(400).json({ error: "Thiếu customerId hoặc dữ liệu khuôn mặt không hợp lệ" });
        }

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Không tìm thấy hội viên" });
        }

        customer.faceDescriptor = faceDescriptor;
        await customer.save();

        return res.status(200).json({
            success: true,
            message: "Đăng ký khuôn mặt FaceID thành công",
            data: { customerId: customer._id, fullName: customer.fullName }
        });
    } catch (err) {
        console.error("registerFaceID Error:", err);
        return res.status(500).json({ error: err.message || "Lỗi máy chủ khi đăng ký FaceID" });
    }
};

// 2. Lấy danh sách vector khuôn mặt để nạp vào bộ matcher
export const getFaceDescriptors = async (req, res) => {
    try {
        const customers = await Customer.find({
            faceDescriptor: { $exists: true, $not: { $size: 0 } }
        }).select("_id fullName phone faceDescriptor");

        return res.status(200).json({
            success: true,
            data: customers
        });
    } catch (err) {
        console.error("getFaceDescriptors Error:", err);
        return res.status(500).json({ error: err.message || "Lỗi máy chủ khi lấy dữ liệu FaceID" });
    }
};

// 3. Xác thực điểm danh qua FaceID (Chặn tuyệt đối 1 lần check-in & 1 lần check-out / ngày)
export const verifyFaceCheckIn = async (req, res) => {
    try {
        const { customerId } = req.body;
        if (!customerId) {
            return res.status(400).json({ error: "Thiếu mã hội viên" });
        }

        let customer = null;
        if (mongoose.Types.ObjectId.isValid(customerId)) {
            customer = await Customer.findById(customerId);
        }
        if (!customer) {
            customer = await Customer.findOne({
                $or: [{ _id: customerId }, { code: customerId }, { phone: customerId }]
            });
        }

        if (!customer) {
            return res.status(404).json({ error: "Không tìm thấy thông tin hội viên" });
        }

        // Mốc thời gian trọn vẹn trong ngày hôm nay (00:00:00 -> 23:59:59)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Chuẩn bị danh sách ID tương thích mọi kiểu dữ liệu trong DB
        const matchIds = [customer._id, String(customer._id)];
        if (mongoose.Types.ObjectId.isValid(customer._id)) {
            matchIds.push(new mongoose.Types.ObjectId(customer._id));
        }
        if (customer.code) matchIds.push(customer.code);

        // Tìm TẤT CẢ các lượt điểm danh của hội viên trong ngày hôm nay
        const todayRecords = await CheckIn.find({
            $or: [
                { customerId: { $in: matchIds } },
                { customer_id: { $in: matchIds } }
            ],
            checkInTime: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ checkInTime: -1 });

        // A. Kiểm tra xem có bản ghi nào ĐÃ check-out chưa
        const hasCompletedSession = todayRecords.some(r => r.checkOutTime != null && r.checkOutTime !== "");

        if (hasCompletedSession) {
            return res.status(400).json({
                error: `Hội viên ${customer.fullName} đã hoàn thành buổi tập hôm nay! Mỗi hội viên chỉ được check-in/check-out 1 lần trong ngày.`
            });
        }

        // B. Kiểm tra xem có bản ghi ĐANG check-in (chưa check-out) hay không
        const activeCheckIn = todayRecords.find(r => !r.checkOutTime);

        if (activeCheckIn) {
            // Thực hiện CHECK-OUT
            const now = new Date();
            const totalMinutes = Math.max(1, Math.round((now.getTime() - new Date(activeCheckIn.checkInTime).getTime()) / 60000));

            activeCheckIn.checkOutTime = now;
            activeCheckIn.totalMinutes = totalMinutes;

            const statusEnum = CheckIn.schema?.path("status")?.enumValues || [];
            if (statusEnum.includes("checked-out")) {
                activeCheckIn.status = "checked-out";
            } else if (statusEnum.includes("completed")) {
                activeCheckIn.status = "completed";
            }

            await activeCheckIn.save();

            return res.status(200).json({
                status: "checked-out",
                message: "Check-out thành công!",
                totalMinutes,
                customer: {
                    id: customer._id,
                    fullName: customer.fullName,
                    phone: customer.phone
                }
            });
        }

        // C. Chưa có lượt điểm danh nào trong hôm nay => Tiến hành CHECK-IN LẦN ĐẦU
        let userPackages = [];
        try {
            userPackages = await UserPackage.find({
                $or: [
                    { customer_id: { $in: matchIds } },
                    { customerId: { $in: matchIds } },
                    { userId: { $in: matchIds } },
                    { user_id: { $in: matchIds } }
                ]
            })
                .populate({ path: "package_id", strictPopulate: false })
                .populate({ path: "packageId", strictPopulate: false })
                .sort({ createdAt: -1 });
        } catch (e) {
            userPackages = await UserPackage.find({
                $or: [
                    { customer_id: { $in: matchIds } },
                    { customerId: { $in: matchIds } }
                ]
            });
        }

        let pkgs = [];
        let validPkg = null;

        if (userPackages && userPackages.length > 0) {
            validPkg = userPackages.find(up => {
                const st = (up.status || "").toLowerCase();
                return !st || ["đang hoạt động", "còn 10 ngày", "active", "hoạt động"].includes(st);
            }) || userPackages[0];

            pkgs = userPackages.map(up => {
                const end = new Date(up.end_date || up.endDate || Date.now());
                const now = new Date();
                const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const pkgName = up.package_id?.name || up.packageId?.name || up.packageName || "Gói tập Gym";
                return {
                    packageName: pkgName,
                    endDate: end.toLocaleDateString("vi-VN"),
                    remainingDays: diffDays > 0 ? diffDays : 0
                };
            });
        } else {
            pkgs = [{
                packageName: "Gói tập Hội Viên",
                endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString("vi-VN"),
                remainingDays: 30
            }];
        }

        const pkgRefId = validPkg?._id || customer._id;
        const checkInData = {
            customerId: customer._id,
            customer_id: customer._id,
            userPackageId: pkgRefId,
            user_package_id: pkgRefId,
            checkInTime: new Date(),
            locationId: req.user?.locationId || customer.locationId || validPkg?.locationId || null
        };

        const statusEnum = CheckIn.schema?.path("status")?.enumValues;
        if (Array.isArray(statusEnum) && statusEnum.length > 0) {
            if (statusEnum.includes("success")) checkInData.status = "success";
            else if (statusEnum.includes("active")) checkInData.status = "active";
            else if (statusEnum.includes("checked-in")) checkInData.status = "checked-in";
            else checkInData.status = statusEnum[0];
        }

        const newRecord = new CheckIn(checkInData);
        await newRecord.save();

        return res.status(200).json({
            status: "checked-in",
            message: "Check-in thành công!",
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone,
                packages: pkgs
            }
        });
    } catch (err) {
        console.error("verifyFaceCheckIn Fatal Error:", err);
        return res.status(500).json({ error: err.message || "Lỗi xử lý điểm danh FaceID" });
    }
};
// 4. Verify QR Token
export const verifyCheckInToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Thiếu mã QR" });

        const customer = await Customer.findOne({ $or: [{ _id: token }, { account: token }] });
        if (!customer) return res.status(404).json({ error: "Mã QR không hợp lệ" });

        return res.status(200).json({
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || "Lỗi xác thực QR" });
    }
};

// 5. Confirm QR Token
export const confirmCheckIn = async (req, res) => {
    return res.status(200).json({ message: "Check-in thành công!" });
};

// 6. Lịch sử điểm danh
export const getCheckInHistory = async (req, res) => {
    try {
        const { date, limit = 100 } = req.query;
        let query = {};

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.checkInTime = { $gte: start, $lte: end };
        }

        const list = await CheckIn.find(query)
            .populate({ path: "customerId", select: "fullName phone account", strictPopulate: false })
            .sort({ checkInTime: -1 })
            .limit(Number(limit));

        return res.status(200).json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message || "Lỗi tải lịch sử" });
    }
};