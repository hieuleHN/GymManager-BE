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
    findActiveMemberships,
    findActiveMembership,
    countActiveMembers,
    summarizeAttendance,
    buildTrend,
    filterAttendance,
    validateVietnamesePhone
} = require('../services/attendanceService');
const { UserPackageV2, MEMBERSHIP_STATUS, PAYMENT_STATUS } = require('../models/userPackageModel');
const { LockerV2, LOCKER_STATUS } = require('../models/lockerModel');
const { StaffV2 } = require('../models/staffModel');
const CustomerV2 = require('../models/customerModel');
const {
    stationLocationId,
    getClubName,
    clubConflict
} = require('../services/clubService');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

// Lấy phòng tập của một hội viên: ưu tiên theo gói membership, fallback theo CustomerV2
const memberLocationId = async (membership) => {
    if (!membership) return null;
    if (membership.locationId) return membership.locationId;
    if (membership.customerId) {
        try {
            const customer = await CustomerV2.findById(membership.customerId).lean();
            if (customer && customer.locationId) return customer.locationId;
        } catch (err) { /* bỏ qua */ }
    }
    return null;
};

// Kiểm tra xung đột phòng tập, trả về res 403 kèm tên phòng tập nếu khác phòng.
// personType để tạo thông báo phù hợp: "Nhân viên này ở phòng tập X" / "Hội viên này ở phòng tập X".
const rejectIfClubConflict = async (res, personLocationId, stationLocationId, personType) => {
    const conflict = clubConflict(personLocationId, stationLocationId);
    if (!conflict) return false;
    const clubName = await getClubName(personLocationId);
    const subject = personType === 'STAFF' ? 'Nhân viên này' : (personType === 'MEMBER' ? 'Hội viên này' : 'Người này');
    res.status(403).json({ success: false, message: `${subject} ở phòng tập ${clubName}` });
    return true;
};

const getAttendanceList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, date, status } = req.query;

        const q = {};
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;

        const allRecords = await AttendanceV2.find(q)
            .populate('customerId', 'fullName phoneNumber email')
            .populate('userPackageId', 'packageName durationMonths')
            .sort({ checkInTime: -1 });

        const filtered = allRecords.filter(record => filterAttendance(record, { search, date, status }));
        const total = filtered.length;

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
        const loc = stationLocationId(req);
        const recordFilter = { checkInTime: { $gte: start, $lte: end } };
        if (loc) recordFilter.locationId = loc;
        const [records, activeMembersCount] = await Promise.all([
            AttendanceV2.find(recordFilter),
            countActiveMembers(loc ? { locationId: { $in: [loc, null] } } : {})
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
        const q = { checkInTime: { $gte: start, $lte: end } };
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;
        const records = await AttendanceV2.find(q)
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

        const q = { checkInTime: { $gte: from } };
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;

        const records = await AttendanceV2.find(q).select('checkInTime');

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
        const loc = stationLocationId(req);
        const membershipFilter = loc ? { locationId: { $in: [loc, null] } } : {};
        const activeMemberships = await findActiveMemberships(membershipFilter);
        activeMemberships.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

        const { start, end } = getDayRange();
        const recordFilter = {
            checkInTime: { $gte: start, $lte: end },
            status: { $in: [CHECKIN_STATUS.SUCCESS, CHECKIN_STATUS.MANUAL] }
        };
        if (loc) recordFilter.locationId = loc;
        const todayRecords = await AttendanceV2.find(recordFilter);
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
        if (!validateVietnamesePhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ (phải bắt đầu bằng 0 và có 10-11 chữ số)!'
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

        // Kiểm tra phòng tập của hội viên so với phòng tập hiện tại
        const personLocationId = await memberLocationId(memberships[0]);
        const rejected = await rejectIfClubConflict(res, personLocationId, stationLocationId(req), 'MEMBER');
        if (rejected) return;

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
        const { customerId, customerPhone, method, note, personType, staffId, lockerId, lockerName } = req.body;
        const isStaff = personType === 'STAFF';

        let phone = customerPhone ? String(customerPhone).trim() : '';
        let activeMembership = null;
        let staff = null;

        if (isStaff) {
            if (staffId) {
                staff = await StaffV2.findById(staffId);
            } else if (phone) {
                staff = await StaffV2.findOne({ phone });
            } else {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp staffId hoặc số điện thoại!' });
            }
            if (!staff) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên!' });
            }
            if (staff.status !== 'ACTIVE') {
                return res.status(400).json({ success: false, message: 'Nhân viên đang bị khóa!' });
            }
            phone = String(staff.phone).trim();
        } else {
            if (customerId) {
                activeMembership = await findActiveMembership({ customerId });
            } else if (phone) {
                if (!validateVietnamesePhone(phone)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Số điện thoại không hợp lệ (phải bắt đầu bằng 0 và có 10-11 chữ số)!'
                    });
                }
                activeMembership = await findActiveMembership({ customerPhone: phone });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng cung cấp customerId hoặc số điện thoại!'
                });
            }

            if (!activeMembership) {
                return res.status(400).json({
                    success: false,
                    message: 'Hội viên không có gói tập còn hiệu lực hoặc chưa thanh toán!'
                });
            }

            phone = activeMembership.customerPhone;
        }

        // Kiểm tra phòng tập: người được điểm danh phải thuộc đúng phòng tập của máy quét
        const stationLoc = stationLocationId(req);
        const personLoc = isStaff ? (staff.locationId || null) : await memberLocationId(activeMembership);
        const rejected = await rejectIfClubConflict(res, personLoc, stationLoc, isStaff ? 'STAFF' : 'MEMBER');
        if (rejected) return;

        const alreadyChecked = await hasCheckedInToday(phone);
        if (alreadyChecked) {
            return res.status(400).json({
                success: false,
                message: 'Người này đã điểm danh hôm nay!'
            });
        }

        // Gán tủ nếu có yêu cầu (chỉ cho phép tủ đang trống)
        let assignedLocker = null;
        if (lockerId) {
            assignedLocker = await LockerV2.findById(lockerId);
            if (!assignedLocker) {
                return res.status(400).json({ success: false, message: 'Không tìm thấy tủ được chọn!' });
            }
            if (stationLoc && assignedLocker.locationId && String(assignedLocker.locationId) !== String(stationLoc)) {
                return res.status(403).json({ success: false, message: 'Tủ này thuộc phòng tập khác!' });
            }
            if (assignedLocker.status !== LOCKER_STATUS.AVAILABLE) {
                return res.status(400).json({ success: false, message: `Tủ ${assignedLocker.lockerNumber} không còn trống!` });
            }
            assignedLocker.status = LOCKER_STATUS.OCCUPIED;
            assignedLocker.previousStatus = null;
            assignedLocker.assignedType = isStaff ? 'STAFF' : 'MEMBER';
            assignedLocker.assignedName = isStaff ? staff.fullName : activeMembership.customerName;
            assignedLocker.assignedPhone = phone;
            assignedLocker.assignedAt = new Date();
            await assignedLocker.save();
        }

        const record = await AttendanceV2.create({
            personType: isStaff ? 'STAFF' : 'MEMBER',
            locationId: personLoc || stationLoc || null,
            customerId: isStaff ? null : (activeMembership.customerId || null),
            customerName: isStaff ? staff.fullName : activeMembership.customerName,
            customerPhone: phone,
            userPackageId: isStaff ? null : activeMembership._id,
            packageName: isStaff ? `Nhân viên · ${staff.role || ''}` : activeMembership.packageName,
            staffId: isStaff ? staff._id : null,
            staffName: isStaff ? staff.fullName : '',
            lockerId: assignedLocker ? assignedLocker._id.toString() : '',
            lockerName: assignedLocker ? assignedLocker.lockerNumber : (lockerName || ''),
            checkInTime: new Date(),
            status: CHECKIN_STATUS.SUCCESS,
            method: Object.values(CHECKIN_METHOD).includes(method) ? method : CHECKIN_METHOD.MANUAL,
            note: note || ''
        });

        return res.status(201).json({
            success: true,
            message: `Điểm danh thành công cho ${record.customerName}${assignedLocker ? ` · Tủ ${assignedLocker.lockerNumber}` : ''}`,
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

// POST /api/v2/attendance/:id/checkout - Checkout: mở khóa + trả tủ về trạng thái trống
const checkOut = async (req, res) => {
    try {
        const record = await AttendanceV2.findById(req.params.id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm danh!' });
        }
        const loc = stationLocationId(req);
        if (loc && record.locationId && String(record.locationId) !== String(loc)) {
            return res.status(403).json({ success: false, message: 'Bản ghi này thuộc phòng tập khác!' });
        }
        if (record.checkOutTime) {
            return res.status(400).json({ success: false, message: 'Người này đã checkout rồi!' });
        }

        let releasedLocker = null;
        if (record.lockerId) {
            const locker = await LockerV2.findById(record.lockerId);
            if (locker && locker.status === LOCKER_STATUS.OCCUPIED) {
                locker.status = LOCKER_STATUS.AVAILABLE;
                locker.assignedType = null;
                locker.assignedName = '';
                locker.assignedPhone = '';
                locker.assignedAt = null;
                await locker.save();
                releasedLocker = locker;
            }
        }

        record.checkOutTime = new Date();
        await record.save();

        return res.json({
            success: true,
            message: releasedLocker
                ? `Đã checkout và mở khóa tủ ${releasedLocker.lockerNumber}`
                : 'Đã checkout thành công',
            data: record,
            releasedLocker: releasedLocker ? { id: releasedLocker._id, lockerNumber: releasedLocker.lockerNumber } : null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi checkout V2',
            error: error.message
        });
    }
};

// POST /api/v2/attendance/staff-lookup - Tra cứu nhân viên theo số điện thoại (chấm công)
const staffLookup = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại!' });
        }
        const staff = await StaffV2.findOne({ phone: String(phone).trim() });
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên với số điện thoại này!' });
        }
        const rejected = await rejectIfClubConflict(res, staff.locationId || null, stationLocationId(req), 'STAFF');
        if (rejected) return;
        return res.status(200).json({
            success: true,
            message: 'Tìm thấy thông tin nhân viên',
            data: {
                staffId: staff._id,
                fullName: staff.fullName,
                phone: staff.phone,
                role: staff.role,
                status: staff.status,
                locationId: staff.locationId || null
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tra cứu nhân viên V2',
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
        const loc = stationLocationId(req);
        if (loc) filter.locationId = loc;

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
        const loc = stationLocationId(req);
        if (loc && record.locationId && String(record.locationId) !== String(loc)) {
            return res.status(403).json({ success: false, message: 'Bản ghi này thuộc phòng tập khác!' });
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
        const record = await AttendanceV2.findById(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi điểm danh V2!'
            });
        }
        const loc = stationLocationId(req);
        if (loc && record.locationId && String(record.locationId) !== String(loc)) {
            return res.status(403).json({ success: false, message: 'Bản ghi này thuộc phòng tập khác!' });
        }
        await AttendanceV2.findByIdAndDelete(record._id);
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
    checkOut,
    staffLookup,
    getMemberHistory,
    updateAttendance,
    deleteAttendance,
    getAttendanceMeta
};
