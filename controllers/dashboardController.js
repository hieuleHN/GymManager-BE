import Customer from "../models/schemas/customerSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Package from "../models/schemas/packageSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import Booking from "../models/schemas/bookingSchema.js";
import Job from "../models/schemas/jobSchema.js";

const getDateRange = (period) => {
    const now = new Date();
    switch (period) {
        case 'month':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), label: 'Tháng này' };
        case 'quarter': {
            const q = Math.floor(now.getMonth() / 3);
            return { start: new Date(now.getFullYear(), q * 3, 1), label: 'Quý này' };
        }
        case 'year':
            return { start: new Date(now.getFullYear(), 0, 1), label: 'Năm nay' };
        default: {
            // Tuần dương lịch: từ Thứ 2 (00:00) của tuần hiện tại
            const day = now.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ... 6 = Thứ 7
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);
            return { start: monday, label: 'Tuần này' };
        }
    }
};

export const getAdminDashboardStats = async (req, res) => {
    try {
        const period = req.query.period || 'week';
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        let { start: periodStart } = getDateRange(period);
        const isCustomDate = !!(req.query.startDate && req.query.endDate);
        if (isCustomDate) {
            periodStart = new Date(req.query.startDate + 'T00:00:00');
        }
        const effectivePeriod = isCustomDate ? 'year' : period;

        // ==========================================================
        // 1. LIÊN KẾT ĐẶT LỊCH HLV
        // ==========================================================
        let bookingStats = { today: 0, month: 0, year: 0 };
        try {
            const [todayCount, monthCount, yearCount] = await Promise.all([
                Booking.countDocuments({ date: { $gte: startOfToday, $lte: endOfToday } }),
                Booking.countDocuments({ date: { $gte: startOfMonth } }),
                Booking.countDocuments({ date: { $gte: startOfYear } })
            ]);
            bookingStats = { today: todayCount, month: monthCount, year: yearCount };
        } catch (e) {
            console.log("Không truy vấn được bảng Booking:", e.message);
        }

        // ==========================================================
        // 2. LIÊN KẾT HỘI VIÊN ĐĂNG KÝ MỚI (Tăng trưởng) — theo period
        // ==========================================================
        let formattedGrowth = [];
        try {
            let growthGroupBy;
            if (effectivePeriod === 'year') {
                growthGroupBy = { $month: "$createdAt" };
            } else if (effectivePeriod === 'month') {
                growthGroupBy = { $ceil: { $divide: [{ $dayOfMonth: "$createdAt" }, 7] } };
            } else {
                growthGroupBy = { $dayOfWeek: "$createdAt" };
            }
            const growthAgg = await Customer.aggregate([
                { $match: { createdAt: { $gte: periodStart } } },
                { $group: { _id: growthGroupBy, count: { $sum: 1 } } },
                { $sort: { "_id": 1 } }
            ]);

            if (effectivePeriod === 'year') {
                const labels = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];
                formattedGrowth = labels.map((l, i) => ({ month: l, count: (growthAgg.find(g => g._id === i+1)?.count) || 0 }));
            } else if (effectivePeriod === 'quarter') {
                const quarterEnd = new Date(periodStart);
                quarterEnd.setMonth(quarterEnd.getMonth() + 3);
                const qCustomers = await Customer.find({ createdAt: { $gte: periodStart, $lt: quarterEnd } }).select('createdAt').lean();
                const qWeekMap = {};
                for (const c of qCustomers) {
                    const daysDiff = Math.floor((c.createdAt - periodStart) / (1000 * 60 * 60 * 24));
                    const weekIdx = Math.floor(daysDiff / 7);
                    qWeekMap[weekIdx] = (qWeekMap[weekIdx] || 0) + 1;
                }
                const qNumDays = Math.ceil((quarterEnd - periodStart) / (1000 * 60 * 60 * 24));
                const qNumWeeks = Math.ceil(qNumDays / 7);
                formattedGrowth = [];
                for (let i = 0; i < qNumWeeks; i++) {
                    formattedGrowth.push({ month: `Tuần ${i + 1}`, count: qWeekMap[i] || 0 });
                }
            } else if (effectivePeriod === 'month') {
                const weeks = ["Tuần 1","Tuần 2","Tuần 3","Tuần 4","Tuần 5"];
                formattedGrowth = weeks.map((l, i) => ({ month: l, count: (growthAgg.find(g => g._id === i+1)?.count) || 0 }));
            } else {
                const days = ["T2","T3","T4","T5","T6","T7","CN"];
                formattedGrowth = days.map((l, i) => {
                    const mongoDay = i + 2 > 7 ? i + 2 - 7 : i + 2;
                    return { month: l, count: (growthAgg.find(g => g._id === mongoDay)?.count) || 0 };
                });
            }
        } catch (e) {
            console.log("Không truy vấn được tăng trưởng:", e.message);
        }

        // ==========================================================
        // 3. PHÂN BỔ HỘI VIÊN THEO MÔN (toàn bộ hội viên đang hoạt động)
        // ==========================================================
        const activeRegs = await UserPackage.find({
            status: "đang hoạt động"
        })
            .populate({
                path: "package_id",
                populate: { path: "disciplineId", select: "name" }
            });
        const sportDistributionMap = {};

        for (const reg of activeRegs) {
            const disciplineName = reg.package_id?.disciplineId?.name;
            if (disciplineName) {
                sportDistributionMap[disciplineName] = (sportDistributionMap[disciplineName] || 0) + 1;
            } else {
                sportDistributionMap["Khác"] = (sportDistributionMap["Khác"] || 0) + 1;
            }
        }

        const formattedSportDistribution = Object.keys(sportDistributionMap).map(key => ({
            name: key,
            value: sportDistributionMap[key]
        }));

        // ==========================================================
        // 4. TẦN SUẤT ĐIỂM DANH (theo period)
        // ==========================================================
        let checkInGroupBy;
        if (effectivePeriod === 'year') {
            checkInGroupBy = { $month: "$checkInTime" };
        } else if (effectivePeriod === 'month') {
            checkInGroupBy = { $ceil: { $divide: [{ $dayOfMonth: "$checkInTime" }, 7] } };
        } else {
            checkInGroupBy = { $dayOfWeek: "$checkInTime" };
        }

        const checkInStats = await CheckIn.aggregate([
            { $match: { checkInTime: { $gte: periodStart } } },
            { $group: { _id: checkInGroupBy, count: { $sum: 1 } } },
            { $sort: { "_id": 1 } }
        ]);

        let checkInOfWeek;
        if (effectivePeriod === 'year') {
            const months = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];
            checkInOfWeek = months.map((l, i) => ({ day: l, count: (checkInStats.find(s => s._id === i+1)?.count) || 0 }));
        } else if (effectivePeriod === 'quarter') {
            const qEnd = new Date(periodStart);
            qEnd.setMonth(qEnd.getMonth() + 3);
            const qCheckins = await CheckIn.find({ checkInTime: { $gte: periodStart, $lt: qEnd } }).select('checkInTime').lean();
            const qWeekMap = {};
            for (const c of qCheckins) {
                const daysDiff = Math.floor((c.checkInTime - periodStart) / (1000 * 60 * 60 * 24));
                const weekIdx = Math.floor(daysDiff / 7);
                qWeekMap[weekIdx] = (qWeekMap[weekIdx] || 0) + 1;
            }
            const qDays = Math.ceil((qEnd - periodStart) / (1000 * 60 * 60 * 24));
            const qWeeks = Math.ceil(qDays / 7);
            checkInOfWeek = [];
            for (let i = 0; i < qWeeks; i++) {
                checkInOfWeek.push({ day: `Tuần ${i + 1}`, count: qWeekMap[i] || 0 });
            }
        } else if (effectivePeriod === 'month') {
            const weeks = ["Tuần 1","Tuần 2","Tuần 3","Tuần 4","Tuần 5"];
            checkInOfWeek = weeks.map((l, i) => ({ day: l, count: (checkInStats.find(s => s._id === i+1)?.count) || 0 }));
        } else {
            const days = ["T2","T3","T4","T5","T6","T7","CN"];
            checkInOfWeek = days.map((l, i) => {
                const mongoDay = i + 2 > 7 ? i + 2 - 7 : i + 2;
                return { day: l, count: (checkInStats.find(s => s._id === mongoDay)?.count) || 0 };
            });
        }

        // ==========================================================
        // 5. HIỆU SUẤT HLV (theo period)
        // ==========================================================
        let trainerPerformance = [];
        try {
            const trainerJobs = await Job.find({
                name: { $regex: /huấn luyện viên|trainer|pt|hlv/i }
            });
            const trainerJobIds = trainerJobs.map(j => j._id);
            const trainers = await Staff.find({ job: { $in: trainerJobIds } });

            trainerPerformance = await Promise.all(trainers.map(async (pt) => {
                const [sessionCount, rejectedCount, cancelledCount] = await Promise.all([
                    Booking.countDocuments({ trainerId: pt._id, date: { $gte: periodStart }, status: 'confirmed' }),
                    Booking.countDocuments({ trainerId: pt._id, date: { $gte: periodStart }, status: 'rejected' }),
                    Booking.countDocuments({ trainerId: pt._id, date: { $gte: periodStart }, status: 'cancelled' }),
                ]);
                return {
                    name: pt.fullName,
                    sessions: sessionCount,
                    rejected: rejectedCount,
                    cancelled: cancelledCount,
                };
            }));
        } catch (e) {
            console.log("Không thể tính hiệu suất HLV:", e.message);
        }

        const totalCheckins = checkInOfWeek.reduce((sum, d) => sum + d.count, 0);
        const totalTrainerSessions = trainerPerformance.reduce((sum, t) => sum + t.sessions, 0);
        let totalNewCustomers = 0;
        try { totalNewCustomers = await Customer.countDocuments({ createdAt: { $gte: periodStart } }); } catch (e) {}

        let totalBookings = 0;
        try { totalBookings = await Booking.countDocuments({ date: { $gte: periodStart } }); } catch (e) {}

        return res.status(200).json({
            bookingStats,
            customerGrowth: formattedGrowth,
            sportDistribution: formattedSportDistribution,
            checkInOfWeek,
            trainerPerformance: trainerPerformance.sort((a, b) => b.sessions - a.sessions),
            summary: {
                totalBookings,
                totalNewCustomers,
                totalCheckins,
                totalTrainerSessions,
            }
        });

    } catch (err) {
        console.error("Dashboard stats error:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getCheckinDetail = async (req, res) => {
    try {
        const dayName = req.query.day;
        const period = req.query.period || 'week';
        const weekOffset = parseInt(req.query.weekOffset);
        const clickedMonth = parseInt(req.query.clickedMonth);

        let { start: periodStart } = getDateRange(period);
        if (req.query.startDate && req.query.endDate) {
            periodStart = new Date(req.query.startDate + 'T00:00:00');
        }
        const isCustomDate = !!(req.query.startDate && req.query.endDate);
        const effectivePeriod = isCustomDate ? 'year' : period;

        let queryStart, queryEnd, label;

        console.log("getCheckinDetail params:", { dayName, period, weekOffset, clickedMonth, periodStart, isCustomDate, effectivePeriod });

        if (!isNaN(weekOffset)) {
            // Week offset from periodStart (month/quarter periods)
            queryStart = new Date(periodStart);
            queryStart.setDate(queryStart.getDate() + weekOffset * 7);
            queryEnd = new Date(queryStart);
            queryEnd.setDate(queryEnd.getDate() + 7);
            label = `Tuần ${weekOffset + 1}`;
        } else if (!isNaN(clickedMonth)) {
            // Specific month (year/custom periods)
            const year = periodStart.getFullYear();
            queryStart = new Date(year, clickedMonth - 1, 1);
            queryEnd = new Date(year, clickedMonth, 1);
            label = `T${clickedMonth}`;
        } else {
            // Day of week (week period)
            const dayMap = { 'CN': 1, 'T2': 2, 'T3': 3, 'T4': 4, 'T5': 5, 'T6': 6, 'T7': 7 };
            const targetDayOfWeek = dayMap[dayName];
            if (!targetDayOfWeek) {
                return res.status(400).json({ error: "Ngày không hợp lệ" });
            }
            queryStart = new Date(periodStart);
            queryEnd = new Date();
            label = dayName;

            const checkins = await CheckIn.aggregate([
                { $match: { checkInTime: { $gte: queryStart, $lte: queryEnd }, $expr: { $eq: [{ $dayOfWeek: "$checkInTime" }, targetDayOfWeek] } } },
                { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
                { $addFields: { customer: { $arrayElemAt: ["$customer", 0] } } },
                { $sort: { checkInTime: -1 } },
                { $project: { _id: 1, checkInTime: 1, fullName: { $ifNull: ["$customer.fullName", "Không xác định"] }, phone: { $ifNull: ["$customer.phone", ""] }, gender: { $ifNull: ["$customer.gender", ""] } } }
            ]);

            const hourlyMap = {};
            for (let i = 6; i <= 22; i++) hourlyMap[`${i}h`] = 0;
            for (const c of checkins) {
                const hour = new Date(c.checkInTime).getHours();
                const key = `${hour}h`;
                if (hourlyMap[key] !== undefined) hourlyMap[key]++;
            }
            const hourly = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));

            return res.status(200).json({ day: label, total: checkins.length, customers: checkins, hourly });
        }

        // Week/month lookup: query by date range
        const checkins = await CheckIn.aggregate([
            { $match: { checkInTime: { $gte: queryStart, $lt: queryEnd } } },
            { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
            { $addFields: { customer: { $arrayElemAt: ["$customer", 0] } } },
            { $sort: { checkInTime: -1 } },
            { $project: { _id: 1, checkInTime: 1, fullName: { $ifNull: ["$customer.fullName", "Không xác định"] }, phone: { $ifNull: ["$customer.phone", ""] }, gender: { $ifNull: ["$customer.gender", ""] } } }
        ]);

        const hourlyMap = {};
        for (let i = 6; i <= 22; i++) hourlyMap[`${i}h`] = 0;
        for (const c of checkins) {
            const hour = new Date(c.checkInTime).getHours();
            const key = `${hour}h`;
            if (hourlyMap[key] !== undefined) hourlyMap[key]++;
        }
        const hourly = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));

        return res.status(200).json({ day: label, total: checkins.length, customers: checkins, hourly });
    } catch (err) {
        console.error("getCheckinDetail error:", err.stack || err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const getSportDetail = async (req, res) => {
    try {
        const sportName = req.query.name;
        if (!sportName) {
            return res.status(400).json({ error: "Thiếu tên môn tập" });
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        const regs = await UserPackage.find({ status: "đang hoạt động" })
            .populate({
                path: "package_id",
                populate: { path: "disciplineId", select: "name" }
            })
            .populate("customer_id", "fullName phone gender email avatar createdAt")
            .sort({ createdAt: -1 });

        const filtered = regs.filter(r => {
            const dName = r.package_id?.disciplineId?.name;
            return dName === sportName;
        });

        const members = filtered.map(r => ({
            _id: r._id,
            fullName: r.customer_id?.fullName || "Không xác định",
            phone: r.customer_id?.phone || "",
            gender: r.customer_id?.gender || "",
            email: r.customer_id?.email || "",
            avatar: r.customer_id?.avatar || "",
            packageName: r.package_id?.name || "Không xác định",
            startDate: r.start_date,
            endDate: r.end_date,
            status: r.status,
            totalPrice: r.total_price || 0,
            registeredAt: r.createdAt,
        }));

        return res.status(200).json({
            sportName,
            total: members.length,
            members,
        });
    } catch (err) {
        console.error("getSportDetail error:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getTrainerDetail = async (req, res) => {
    try {
        const trainerName = req.query.name;
        const period = req.query.period || 'week';
        if (!trainerName) {
            return res.status(400).json({ error: "Thiếu tên HLV" });
        }

        let { start: periodStart } = getDateRange(period);
        if (req.query.startDate && req.query.endDate) {
            periodStart = new Date(req.query.startDate + 'T00:00:00');
        }

        const trainer = await Staff.findOne({ fullName: trainerName });
        if (!trainer) {
            return res.status(404).json({ error: "Không tìm thấy HLV" });
        }

        const bookings = await Booking.find({
            trainerId: trainer._id,
            date: { $gte: periodStart }
        })
            .populate("customerId", "fullName phone gender")
            .populate("locationId", "name")
            .sort({ date: -1 })
            .lean();

        const sessions = bookings.map(b => ({
            _id: b._id,
            customerName: b.customerId?.fullName || "Không xác định",
            customerPhone: b.customerId?.phone || "",
            customerGender: b.customerId?.gender || "",
            date: b.date,
            time: b.startTime || b.time || "",
            discipline: b.disciplineName || "",
            location: b.locationId?.name || "",
            status: b.status,
            price: b.price || 0,
        }));

        const totalSessions = sessions.length;
        const uniqueCustomers = new Set(sessions.map(s => s.customerPhone)).size;

        return res.status(200).json({
            trainerName: trainer.fullName,
            totalSessions,
            uniqueCustomers,
            sessions,
        });
    } catch (err) {
        console.error("getTrainerDetail error:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getMonthlyDetail = async (req, res) => {
    try {
        const month = parseInt(req.query.month);
        if (!month || month < 1 || month > 12) {
            return res.status(400).json({ error: "Tháng không hợp lệ (1-12)" });
        }

        const now = new Date();
        const year = now.getFullYear();
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 1);

        // Lấy danh sách khách hàng đăng ký trong tháng
        const customers = await Customer.find({
            createdAt: { $gte: startOfMonth, $lt: endOfMonth }
        }).sort({ createdAt: -1 });

        const customerIds = customers.map(c => c._id);

        // Lấy gói tập của các khách hàng này
        const userPackages = await UserPackage.find({
            customer_id: { $in: customerIds }
        }).populate({
            path: "package_id",
            select: "name price"
        });

        // Thống kê theo giới tính
        const byGender = [
            { name: "Nam", count: customers.filter(c => c.gender === "Nam").length },
            { name: "Nữ", count: customers.filter(c => c.gender === "Nữ").length },
            { name: "Khác", count: customers.filter(c => c.gender === "Khác" || !c.gender).length },
        ].filter(g => g.count > 0);

        // Thống kê theo gói tập
        const packageMap = {};
        let totalRevenue = 0;
        for (const up of userPackages) {
            const pkgName = up.package_id?.name || "Không xác định";
            packageMap[pkgName] = (packageMap[pkgName] || 0) + 1;
            totalRevenue += up.total_price || 0;
        }
        const byPackage = Object.entries(packageMap).map(([name, count]) => ({ name, count }));

        // Danh sách khách hàng chi tiết
        const customerList = customers.map(c => {
            const pkg = userPackages.find(up => up.customer_id.toString() === c._id.toString());
            return {
                _id: c._id,
                fullName: c.fullName || "Chưa có tên",
                phone: c.phone || "",
                email: c.email || "",
                gender: c.gender || "Khác",
                package: pkg?.package_id?.name || "Chưa đăng ký",
                totalPrice: pkg?.total_price || 0,
                createdAt: c.createdAt,
            };
        });

        return res.status(200).json({
            month,
            year,
            total: customers.length,
            byGender,
            byPackage,
            totalRevenue,
            customers: customerList,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};