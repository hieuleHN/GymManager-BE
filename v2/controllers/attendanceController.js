const {
    AttendanceV2,
    CHECKIN_STATUS,
    CHECKIN_STATUS_LABELS,
    CHECKIN_METHOD,
    CHECKIN_METHOD_LABELS
} = require('../models/attendanceModel');
const {
    getDayRange,
    toDateKey,
    formatTimeLabel,
    hasCheckedInToday,
    findActiveMembership,
    summarizeAttendance,
    buildTrend,
    filterAttendance
} = require('../services/attendanceService');
const { UserPackageV2, MEMBERSHIP_STATUS, PAYMENT_STATUS } = require('../models/userPackageModel');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const countActiveMembers = async () => {
    return UserPackageV2.countDocuments({
        status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] },
        paymentStatus: PAYMENT_STATUS.PAID,
        endDate: { $gte: new Date() }
    });
};

const getAttendanceList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, date, status } = req.query;

        const allRecords = await AttendanceV2.find()
            .populate('customerId', 'fullName phoneNumber email')
            .populate('userPackageId', 'packageName durationMonths')
            .sort({ checkInTime: -1 });
        const total = allRecords.length;

        const filtered = allRecords.filter(record => filterAttendance(record, { search, date, status }));

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách điểm danh V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách điểm danh V2',
            error: error.message
        });
    }
};

const getAttendanceSummary = async (req, res) => {
    try {
        const { start, end } = getDayRange();
        const [records, activeMembersCount] = await Promise.all([
            AttendanceV2.find({ checkInTime: { $gte: start, $lte: end } }),
            countActiveMembers()
        ]);

        const summary = summarizeAttendance(records, activeMembersCount);
        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan điểm danh V2 thành công',
            data: { ...summary, date: toDateKey(new Date()) }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan điểm danh V2',
            error: error.message
        });
    }
};

const getTodayAttendance = async (req, res) => {
    try {
        const { start, end } = getDayRange();
        const records = await AttendanceV2.find({ checkInTime: { $gte: start, $lte: end } })
            .populate('customerId', 'fullName phoneNumber')
            .populate('userPackageId', 'packageName durationMonths')
            .sort({ checkInTime: -1 });

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách điểm danh hôm nay V2 thành công',
            data: records
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách điểm danh hôm nay V2',
            error: error.message
        });
    }
};

const getAttendanceTrend = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const { start } = getDayRange();
        const from = new Date(start);
        from.setDate(from.getDate() - (days - 1));

        const records = await AttendanceV2.find({
            checkInTime: { $gte: from }
        }).select('checkInTime');

        const trend = buildTrend(records, days);
        return res.status(200).json({
            success: true,
            message: 'Lấy thống kê điểm danh theo ngày V2 thành công',
            data: trend
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thống kê điểm danh V2',
            error: error.message
        });
    }
};

const getMembersStatus = async (req, res) => {
    try {
        const activeMemberships = await UserPackageV2.find({
            status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] },
            paymentStatus: PAYMENT_STATUS.PAID,
            endDate: { $gte: new Date() }
        }).sort({ endDate: 1 });

        const { start, end } = getDayRange();
        const todayRecords = await AttendanceV2.find({
            checkInTime: { $gte: start, $lte: end },
            status: { $in: [CHECKIN_STATUS.SUCCESS, CHECKIN_STATUS.MANUAL] }
        });
        const checkedInMap = {};
        todayRecords.forEach(record => {
            checkedInMap[record.customerPhone] = record;
        });

        const members = activeMemberships.map(membership => {
            const record = checkedInMap[membership.customerPhone];
            const remainingDays = membership.remainingDays;
            return {
                customerId: membership.customerId,
                customerName: membership.customerName,
                customerPhone: membership.customerPhone,
                packageName: membership.packageName,
                membershipId: membership._id,
                remainingDays,
                checkedIn: !!record,
                checkInTime: record ? record.timeLabel : null,
                attendanceId: record ? record._id : null
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Lấy trạng thái điểm danh hội viên V2 thành công',
            data: members
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy trạng thái điểm danh hội viên V2',
            error: error.message
        });
    }
};

const lookupMembership = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !phone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập số điện thoại!'
            });
        }

        const memberships = await UserPackageV2.find({
            customerPhone: phone.trim(),
            paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PENDING] }
        }).sort({ createdAt: -1 });

        if (memberships.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hội viên với số điện thoại này!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tìm thấy thông tin hội viên',
            data: {
                customerName: memberships[0].customerName,
                customerPhone: memberships[0].customerPhone,
                customerId: memberships[0].customerId,
                memberships: memberships.map(m => ({
                    _id: m._id,
                    packageName: m.packageName,
                    status: m.status,
                    paymentStatus: m.paymentStatus,
                    endDate: m.endDate,
                    remainingDays: m.remainingDays,
                    valid: m.status !== MEMBERSHIP_STATUS.CANCELLED && new Date(m.endDate) >= new Date()
                }))
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tìm kiếm hội viên V2',
            error: error.message
        });
    }
};

const checkIn = async (req, res) => {
    try {
        const { customerId, customerPhone, method, note } = req.body;

        let phone = customerPhone ? String(customerPhone).trim() : '';
        let activeMembership = null;

        if (customerId) {
            activeMembership = await findActiveMembership({ customerId });
        } else if (phone) {
            activeMembership = await findActiveMembership({ customerPhone: phone });
        }

        if (!activeMembership) {
            return res.status(400).json({
                success: false,
                message: 'Hội viên không có gói tập còn hiệu lực hoặc chưa thanh toán!'
            });
        }

        phone = activeMembership.customerPhone;

        const alreadyChecked = await hasCheckedInToday(phone);
        if (alreadyChecked) {
            return res.status(400).json({
                success: false,
                message: 'Hội viên đã điểm danh hôm nay!'
            });
        }

        const record = await AttendanceV2.create({
            customerId: activeMembership.customerId || null,
            customerName: activeMembership.customerName,
            customerPhone: phone,
            userPackageId: activeMembership._id,
            packageName: activeMembership.packageName,
            checkInTime: new Date(),
            status: CHECKIN_STATUS.SUCCESS,
            method: Object.values(CHECKIN_METHOD).includes(method) ? method : CHECKIN_METHOD.MANUAL,
            note: note || ''
        });

        return res.status(201).json({
            success: true,
            message: `Điểm danh thành công cho hội viên "${record.customerName}" lúc ${record.timeLabel}`,
            data: record
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi điểm danh V2',
            error: error.message
        });
    }
};

const getMemberHistory = async (req, res) => {
    try {
        const { customerId, phone } = req.query;
        const filter = {};
        if (customerId) filter.customerId = customerId;
        if (phone) filter.customerPhone = phone;
        if (!filter.customerId && !filter.customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Cần cung cấp customerId hoặc phone!'
            });
        }

        const history = await AttendanceV2.find(filter)
            .populate('userPackageId', 'packageName durationMonths')
            .sort({ checkInTime: -1 });

        return res.status(200).json({
            success: true,
            message: 'Lấy lịch sử điểm danh hội viên V2 thành công',
            data: history
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch sử điểm danh hội viên V2',
            error: error.message
        });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const record = await AttendanceV2.findById(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi điểm danh V2!'
            });
        }

        const { checkInTime, status, note } = req.body;
        if (checkInTime !== undefined) record.checkInTime = new Date(checkInTime);
        if (status !== undefined && Object.values(CHECKIN_STATUS).includes(status)) record.status = status;
        if (note !== undefined) record.note = note;

        const saved = await record.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật bản ghi điểm danh V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật bản ghi điểm danh V2',
            error: error.message
        });
    }
};

const deleteAttendance = async (req, res) => {
    try {
        const record = await AttendanceV2.findByIdAndDelete(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi điểm danh V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Xóa bản ghi điểm danh V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa bản ghi điểm danh V2',
            error: error.message
        });
    }
};

const getAttendanceMeta = async (req, res) => {
    try {
        const statuses = Object.values(CHECKIN_STATUS).map(key => ({
            key,
            label: CHECKIN_STATUS_LABELS[key]
        }));
        const methods = Object.values(CHECKIN_METHOD).map(key => ({
            key,
            label: CHECKIN_METHOD_LABELS[key]
        }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách trạng thái điểm danh V2 thành công',
            data: { statuses, methods }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách trạng thái điểm danh V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getAttendanceList,
    getAttendanceSummary,
    getTodayAttendance,
    getAttendanceTrend,
    getMembersStatus,
    lookupMembership,
    checkIn,
    getMemberHistory,
    updateAttendance,
    deleteAttendance,
    getAttendanceMeta
};
