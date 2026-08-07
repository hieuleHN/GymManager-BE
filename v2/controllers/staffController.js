const { StaffV2, STAFF_ROLES, STAFF_PERMISSIONS } = require('../models/staffModel');
const { stationLocationId, getClubName } = require('../services/clubService');

// Nhân viên có phòng tập chỉ được thao tác với nhân viên cùng phòng tập / chưa gán phòng.
// Trả về res 403 kèm tên phòng tập nếu nhân viên đích thuộc phòng tập khác.
const rejectIfOtherClub = async (res, staff, req) => {
    const loc = stationLocationId(req);
    if (!loc || !staff || !staff.locationId) return false;
    if (String(staff.locationId) === String(loc)) return false;
    const clubName = await getClubName(staff.locationId);
    res.status(403).json({ success: false, message: `Nhân viên này ở phòng tập ${clubName}` });
    return true;
};

const validateVietnamesePhone = (phone) => {
    if (!phone) return false;
    return /(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone.trim());
};

const formatStaffName = (fullName) => {
    if (!fullName) return '';
    return fullName
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const formatWorkSchedule = (workSchedule) => {
    if (!Array.isArray(workSchedule)) return [];
    return workSchedule.map(shift => {
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return {
            ...shift,
            dayLabel: dayLabels[shift.dayOfWeek] || 'CN'
        };
    });
};

const getStaffList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, role, status } = req.query;

        const filter = {};
        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { fullName: regex },
                { account: regex },
                { email: regex },
                { phone: regex }
            ];
        }
        if (role) filter.role = role;
        if (status) filter.status = status;
        // Nhân viên có phòng tập -> chỉ quản lý nhân viên của phòng tập mình (+ chưa gán phòng)
        const loc = stationLocationId(req);
        if (loc) filter.locationId = { $in: [loc, null] };

        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            StaffV2.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            StaffV2.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách nhân viên V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách nhân viên V2',
            error: error.message
        });
    }
};

const getStaffById = async (req, res) => {
    try {
        const staff = await StaffV2.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên V2!'
            });
        }
        if (await rejectIfOtherClub(res, staff, req)) return;
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin nhân viên V2 thành công',
            data: staff
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin nhân viên V2',
            error: error.message
        });
    }
};

const createStaff = async (req, res) => {
    try {
        const { account, password, fullName, email, phone, gender, role, permissions, workSchedule, startDate, address, baseSalary, locationId } = req.body;

        if (!account || !password || !fullName || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ tài khoản, mật khẩu, họ tên và số điện thoại!'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 6 ký tự!'
            });
        }
        if (!validateVietnamesePhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không đúng định dạng Việt Nam!'
            });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ!'
            });
        }

        const existing = await StaffV2.findOne({ $or: [{ account: account.toLowerCase() }, { email: email || '' }] });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản hoặc email đã tồn tại trong hệ thống!'
            });
        }

        const staffRole = STAFF_ROLES.includes(role) ? role : 'STAFF';
        const staffPermissions = Array.isArray(permissions)
            ? permissions.filter(p => STAFF_PERMISSIONS.includes(p))
            : [];

        // Nhân viên có phòng tập chỉ được tạo nhân viên cho đúng phòng tập của mình
        const stationLoc = stationLocationId(req);
        const staffLocation = stationLoc ? stationLoc : (locationId || null);

        const staff = await StaffV2.create({
            account: account.trim().toLowerCase(),
            password,
            fullName: formatStaffName(fullName),
            email: email || '',
            phone: phone.trim(),
            gender: gender || 'Nam',
            role: staffRole,
            permissions: staffPermissions,
            workSchedule: Array.isArray(workSchedule) ? workSchedule : [],
            startDate: startDate || new Date(),
            address: address || '',
            locationId: staffLocation,
            baseSalary: baseSalary || 0,
            status: 'ACTIVE'
        });

        return res.status(201).json({
            success: true,
            message: 'Thêm nhân viên V2 thành công',
            data: staff
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản đã tồn tại trong hệ thống!'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thêm nhân viên V2',
            error: error.message
        });
    }
};

const updateStaff = async (req, res) => {
    try {
        const staff = await StaffV2.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên V2!'
            });
        }
        if (await rejectIfOtherClub(res, staff, req)) return;

        const { password, fullName, email, phone, gender, role, permissions, workSchedule, startDate, address, baseSalary, status, locationId } = req.body;

        if (fullName !== undefined) staff.fullName = formatStaffName(fullName);
        if (email !== undefined) staff.email = email;
        // Nhân viên có phòng tập không được gán/chuyển nhân viên sang phòng tập khác
        const stationLoc = stationLocationId(req);
        if (locationId !== undefined) {
            staff.locationId = stationLoc ? stationLoc : (locationId || null);
        }
        if (phone !== undefined) {
            if (!validateVietnamesePhone(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Số điện thoại không đúng định dạng Việt Nam!'
                });
            }
            staff.phone = phone.trim();
        }
        if (gender !== undefined) staff.gender = gender;
        if (role !== undefined) staff.role = STAFF_ROLES.includes(role) ? role : staff.role;
        if (permissions !== undefined) {
            staff.permissions = Array.isArray(permissions)
                ? permissions.filter(p => STAFF_PERMISSIONS.includes(p))
                : [];
        }
        if (workSchedule !== undefined) staff.workSchedule = Array.isArray(workSchedule) ? workSchedule : [];
        if (startDate !== undefined) staff.startDate = startDate;
        if (address !== undefined) staff.address = address;
        if (baseSalary !== undefined) staff.baseSalary = baseSalary;
        if (status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status)) staff.status = status;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu phải có ít nhất 6 ký tự!'
                });
            }
            staff.password = password;
        }

        const saved = await staff.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật nhân viên V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật nhân viên V2',
            error: error.message
        });
    }
};

const deleteStaff = async (req, res) => {
    try {
        const staff = await StaffV2.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên V2!'
            });
        }
        if (await rejectIfOtherClub(res, staff, req)) return;
        await StaffV2.findByIdAndDelete(staff._id);
        return res.status(200).json({
            success: true,
            message: 'Xóa nhân viên V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa nhân viên V2',
            error: error.message
        });
    }
};

const toggleStaffStatus = async (req, res) => {
    try {
        const staff = await StaffV2.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên V2!'
            });
        }
        if (await rejectIfOtherClub(res, staff, req)) return;
        staff.status = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const saved = await staff.save();
        return res.status(200).json({
            success: true,
            message: `Đã chuyển trạng thái nhân viên sang ${saved.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật trạng thái nhân viên V2',
            error: error.message
        });
    }
};

const getRolesAndPermissions = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách vai trò và quyền V2 thành công',
            data: {
                roles: STAFF_ROLES,
                permissions: STAFF_PERMISSIONS
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách vai trò V2',
            error: error.message
        });
    }
};

const getStaffSummary = async (req, res) => {
    try {
        // Nhân viên có phòng tập -> thống kê theo đúng phòng tập của mình (+ nhân viên chưa gán phòng)
        const loc = stationLocationId(req);
        const filter = loc ? { locationId: { $in: [loc, null] } } : {};
        const [total, active, inactive] = await Promise.all([
            StaffV2.countDocuments(filter),
            StaffV2.countDocuments({ ...filter, status: 'ACTIVE' }),
            StaffV2.countDocuments({ ...filter, status: 'INACTIVE' })
        ]);

        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan nhân viên V2 thành công',
            data: {
                total,
                active,
                inactive
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan nhân viên V2',
            error: error.message
        });
    }
};

module.exports = {
    validateVietnamesePhone,
    formatStaffName,
    formatWorkSchedule,
    getStaffList,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
    getRolesAndPermissions,
    getStaffSummary
};
