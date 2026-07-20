import Customer from "../models/schemas/customerSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import Booking from "../models/schemas/bookingSchema.js";

export const getAdminDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // ==========================================================
        // 1. LIÊN KẾT ĐẶT LỊCH HLV (Sử dụng trường chuẩn booking_date)
        // ==========================================================
        let bookingStats = { today: 0, month: 0, year: 0 };
        try {
            const [todayCount, monthCount, yearCount] = await Promise.all([
                Booking.countDocuments({ booking_date: { $gte: startOfToday, $lte: endOfToday } }),
                Booking.countDocuments({ booking_date: { $gte: startOfMonth } }),
                Booking.countDocuments({ booking_date: { $gte: startOfYear } })
            ]);
            bookingStats = { today: todayCount, month: monthCount, year: yearCount };
        } catch (e) {
            console.log("Không truy vấn được bảng Booking:", e.message);
        }

        // ==========================================================
        // 2. LIÊN KẾT HỘI VIÊN ĐĂNG KÝ MỚI (Tăng trưởng theo tháng)
        // ==========================================================
        const customerGrowth = await Customer.aggregate([
            { $match: { createdAt: { $gte: startOfYear } } },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const monthsLabel = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
        const formattedGrowth = monthsLabel.map((label, index) => {
            const found = customerGrowth.find(item => item._id === (index + 1));
            return {
                month: label,
                count: found ? found.count : 0
            };
        });

        // ==========================================================
        // 3. LIÊN KẾT HỘI VIÊN HOẠT ĐỘNG THEO MÔN (status: "đang hoạt động")
        // ==========================================================
        const activePackages = await UserPackage.find({ status: "đang hoạt động" });
        const sportDistributionMap = {};

        activePackages.forEach(pkg => {
            const name = (pkg.packageName || "").toLowerCase();
            let category = "Gym & Fitness";

            if (name.includes("yoga")) category = "Yoga";
            else if (name.includes("boxing") || name.includes("võ")) category = "Kick Boxing";
            else if (name.includes("zumba") || name.includes("dance")) category = "Dance / Zumba";
            else if (name.includes("pilates")) category = "Pilates";

            sportDistributionMap[category] = (sportDistributionMap[category] || 0) + 1;
        });

        const formattedSportDistribution = Object.keys(sportDistributionMap).map(key => ({
            name: key,
            value: sportDistributionMap[key]
        }));

        // ==========================================================
        // 4. LIÊN KẾT TẦN SUẤT ĐIỂM DANH (Dữ liệu check-in 7 ngày gần nhất)
        // ==========================================================
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const checkInStats = await CheckIn.aggregate([
            { $match: { checkInTime: { $gte: oneWeekAgo } } },
            {
                $group: {
                    _id: { $dayOfWeek: "$checkInTime" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const daysOfWeekLabel = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        const formattedCheckInOfWeek = daysOfWeekLabel.map((label, index) => {
            const found = checkInStats.find(item => item._id === (index + 1));
            return {
                day: label,
                count: found ? found.count : 0
            };
        });

        const mondayFirstCheckins = [...formattedCheckInOfWeek.slice(1), formattedCheckInOfWeek[0]];

        // ==========================================================
        // 5. LIÊN KẾT HIỆU SUẤT HLV (Sử dụng trường chuẩn assigned_guide_id)
        // ==========================================================
        let trainerPerformance = [];
        try {
            // Tìm tất cả nhân viên có vai trò liên quan đến PT hoặc Trainer
            const trainers = await Staff.find({
                $or: [
                    { role: { $regex: /pt|trainer/i } },
                    { role_id: { $exists: true } } // Nếu bạn dùng liên kết bảng role_id
                ]
            });

            trainerPerformance = await Promise.all(trainers.map(async (pt) => {
                const completedSessions = await Booking.countDocuments({
                    assigned_guide_id: pt._id, // Khớp chuẩn khóa ngoại của bảng bookings
                    status: "completed"
                });
                return {
                    name: pt.fullName,
                    sessions: completedSessions
                };
            }));
        } catch (e) {
            console.log("Không thể tính hiệu suất HLV:", e.message);
        }

        // TRẢ VỀ DỮ LIỆU ĐỒNG BỘ HOÀN TOÀN
        return res.status(200).json({
            bookingStats,
            customerGrowth: formattedGrowth,
            sportDistribution: formattedSportDistribution,
            checkInOfWeek: mondayFirstCheckins,
            trainerPerformance: trainerPerformance.sort((a, b) => b.sessions - a.sessions)
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};