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

// 2. Lấy danh sách vector khuôn mặt để Frontend nạp vào bộ matcher
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

// 3. Xác thực điểm danh qua FaceID
export const verifyFaceCheckIn = async (req, res) => {
    try {
        const { customerId } = req.body;
        if (!customerId) {
            return res.status(400).json({ error: "Thiếu mã hội viên" });
        }

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Không tìm thấy thông tin hội viên" });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1. Tìm bản ghi check-in hôm nay
        const existingCheckIn = await CheckIn.findOne({
            $or: [{ customerId: customer._id }, { customer_id: customer._id }],
            checkInTime: { $gte: todayStart }
        }).sort({ checkInTime: -1 });

        // Nếu đã check-in nhưng chưa check-out => CHECK-OUT
        if (existingCheckIn && !existingCheckIn.checkOutTime) {
            const now = new Date();
            const totalMinutes = Math.max(1, Math.round((now.getTime() - new Date(existingCheckIn.checkInTime).getTime()) / 60000));

            existingCheckIn.checkOutTime = now;

            const statusEnum = CheckIn.schema?.path("status")?.enumValues || [];
            if (statusEnum.includes("checked-out")) {
                existingCheckIn.status = "checked-out";
            } else if (statusEnum.includes("completed")) {
                existingCheckIn.status = "completed";
            }

            existingCheckIn.totalMinutes = totalMinutes;
            await existingCheckIn.save();

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

        // 2. Lấy danh sách gói tập (Tìm theo cả 2 trường customer_id và customerId)
        let activePackages = [];
        try {
            activePackages = await UserPackage.find({
                $or: [
                    { customer_id: customer._id },
                    { customerId: customer._id }
                ]
            })
                .populate("package_id")
                .populate("packageId")
                .sort({ createdAt: -1 });
        } catch (e) {
            console.error("Lỗi tìm gói tập:", e);
        }

        if (!activePackages || activePackages.length === 0) {
            return res.status(400).json({
                error: `Hội viên ${customer.fullName} chưa có gói tập nào! Vui lòng đăng ký gói tập trước khi điểm danh.`
            });
        }

        const validPkg = activePackages.find(up =>
            !up.status || ["đang hoạt động", "còn 10 ngày", "active", "ACTIVE"].includes(up.status)
        ) || activePackages[0];

        const pkgs = activePackages.map(up => {
            const end = new Date(up.end_date || up.endDate || Date.now());
            const now = new Date();
            const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const pkgName = up.package_id?.name || up.packageId?.name || up.packageName || "Gói tập";
            return {
                packageName: pkgName,
                endDate: end.toLocaleDateString("vi-VN"),
                remainingDays: diffDays > 0 ? diffDays : 0
            };
        });

        // 3. Tạo bản ghi Check-in (Gán cả 2 định dạng trường để tương thích 100% Schema)
        const checkInData = {
            customerId: customer._id,
            customer_id: customer._id,
            userPackageId: validPkg._id,
            user_package_id: validPkg._id,
            checkInTime: new Date(),
            locationId: req.user?.locationId || customer.locationId || validPkg.locationId || null
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
        console.error("verifyFaceCheckIn Error Detail:", err);
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
            .populate("customerId", "fullName phone account")
            .sort({ checkInTime: -1 })
            .limit(Number(limit));

        return res.status(200).json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message || "Lỗi tải lịch sử" });
    }
};