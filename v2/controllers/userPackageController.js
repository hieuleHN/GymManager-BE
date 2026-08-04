const {
    UserPackageV2,
    MEMBERSHIP_STATUS,
    MEMBERSHIP_STATUS_LABELS,
    PAYMENT_STATUS,
    PAYMENT_STATUS_LABELS,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABELS
} = require('../models/userPackageModel');
const {
    computeStatus,
    isActive,
    computeEndDate,
    buildMembershipCode,
    summarizeMemberships,
    filterMembership,
    refreshStatuses,
    validateVietnamesePhone
} = require('../services/membershipService');
const { PackageV2 } = require('../models/packageModel');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const getMembershipList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, status, paymentStatus } = req.query;

        const allMemberships = await UserPackageV2.find()
            .populate('customerId', 'fullName phoneNumber email')
            .populate('packageId', 'name type')
            .sort({ createdAt: -1 });

        // Trạng thái gói hội viên tính tự động theo thời gian hiện tại
        const membershipsWithStatus = allMemberships.map(membership => {
            membership.status = computeStatus(membership);
            return membership;
        });

        const filtered = membershipsWithStatus.filter(membership => filterMembership(membership, { search, status, paymentStatus }));

        const total = filtered.length;
        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách gói hội viên V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách gói hội viên V2',
            error: error.message
        });
    }
};

const getMembershipSummary = async (req, res) => {
    try {
        const summary = await summarizeMemberships();
        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan gói hội viên V2 thành công',
            data: summary
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan gói hội viên V2',
            error: error.message
        });
    }
};

const getMembershipById = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id)
            .populate('customerId', 'fullName phoneNumber email')
            .populate('packageId', 'name type price discountPercent features');
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }
        membership.status = computeStatus(membership);
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin gói hội viên V2 thành công',
            data: membership
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin gói hội viên V2',
            error: error.message
        });
    }
};

const getCustomerMemberships = async (req, res) => {
    try {
        const memberships = await UserPackageV2.find({ customerId: req.params.customerId })
            .populate('packageId', 'name type price')
            .sort({ createdAt: -1 });
        memberships.forEach(membership => {
            membership.status = computeStatus(membership);
        });
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách gói của hội viên V2 thành công',
            data: memberships
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy gói của hội viên V2',
            error: error.message
        });
    }
};

const registerMembership = async (req, res) => {
    try {
        const {
            customerId,
            customerName,
            customerPhone,
            customerEmail,
            packageId,
            durationMonths,
            startDate,
            totalPrice,
            paymentStatus,
            paymentMethod,
            note
        } = req.body;

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập tên hội viên!'
            });
        }
        if (!customerPhone || !customerPhone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập số điện thoại hội viên!'
            });
        }
        if (!validateVietnamesePhone(customerPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại hội viên không đúng định dạng Việt Nam (VD: 0912345678)!'
            });
        }

        let packageName = '';
        let packageType = 'STANDARD';
        let ptSessionsPerMonth = 0;
        let finalDuration = parseInt(durationMonths) || 1;
        let finalPrice = Number(totalPrice) || 0;

        if (packageId) {
            const pkg = await PackageV2.findById(packageId);
            if (pkg) {
                packageName = pkg.name;
                packageType = pkg.type || 'STANDARD';
                ptSessionsPerMonth = pkg.ptSessionsPerMonth || 0;
                if (pkg.durationMonths > 0) finalDuration = pkg.durationMonths;
                if (pkg.effectivePrice > 0) finalPrice = pkg.effectivePrice;
            }
        }
        if (!packageName) {
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy gói tập để đăng ký!'
            });
        }

        const start = startDate ? new Date(startDate) : new Date();
        const end = computeEndDate(start, finalDuration);

        // Trạng thái ban đầu tính tự động theo thời gian
        const initialStatus = computeStatus({ startDate: start, endDate: end, status: MEMBERSHIP_STATUS.ACTIVE });

        const membership = await UserPackageV2.create({
            customerId: customerId || null,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail || '',
            packageId: packageId || null,
            packageName,
            packageType,
            durationMonths: finalDuration,
            ptSessionsPerMonth,
            startDate: start,
            endDate: end,
            totalPrice: finalPrice,
            paymentStatus: Object.values(PAYMENT_STATUS).includes(paymentStatus) ? paymentStatus : PAYMENT_STATUS.PAID,
            paymentMethod: Object.values(PAYMENT_METHOD).includes(paymentMethod) ? paymentMethod : PAYMENT_METHOD.CASH,
            paidAt: paymentStatus === PAYMENT_STATUS.PAID ? new Date() : null,
            note: note || '',
            status: initialStatus
        });

        membership.membershipCode = buildMembershipCode(membership);
        await membership.save();

        return res.status(201).json({
            success: true,
            message: `Đăng ký gói "${membership.packageName}" cho hội viên "${membership.customerName}" thành công. Mã: ${membership.membershipCode}`,
            data: membership
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi đăng ký gói hội viên V2',
            error: error.message
        });
    }
};

const updateMembership = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }

        const {
            startDate,
            endDate,
            durationMonths,
            totalPrice,
            paymentStatus,
            paymentMethod,
            usedSessions,
            note
        } = req.body;

        if (startDate !== undefined) membership.startDate = new Date(startDate);
        if (durationMonths !== undefined) membership.durationMonths = Number(durationMonths) || 1;
        if (endDate !== undefined && endDate) {
            membership.endDate = new Date(endDate);
        } else if (startDate !== undefined || durationMonths !== undefined) {
            membership.endDate = computeEndDate(membership.startDate, membership.durationMonths);
        }
        if (totalPrice !== undefined) membership.totalPrice = Number(totalPrice) || 0;
        if (paymentStatus !== undefined && Object.values(PAYMENT_STATUS).includes(paymentStatus)) {
            membership.paymentStatus = paymentStatus;
            if (paymentStatus === PAYMENT_STATUS.PAID && !membership.paidAt) {
                membership.paidAt = new Date();
            }
        }
        if (paymentMethod !== undefined && Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
            membership.paymentMethod = paymentMethod;
        }
        if (usedSessions !== undefined && Number(usedSessions) >= 0) membership.usedSessions = Number(usedSessions);
        if (note !== undefined) membership.note = note;

        if (membership.status !== MEMBERSHIP_STATUS.CANCELLED) {
            membership.status = computeStatus(membership);
        }

        const saved = await membership.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật gói hội viên V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật gói hội viên V2',
            error: error.message
        });
    }
};

const extendMembership = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }
        if (membership.status === MEMBERSHIP_STATUS.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Gói đã hủy không thể gia hạn!'
            });
        }

        const { addMonths, additionalPrice } = req.body;
        const months = parseInt(addMonths) || 1;
        if (months < 1) {
            return res.status(400).json({
                success: false,
                message: 'Số tháng gia hạn phải lớn hơn 0!'
            });
        }

        const base = new Date(membership.endDate);
        const newEnd = new Date(base);
        newEnd.setMonth(newEnd.getMonth() + months);

        membership.endDate = newEnd;
        membership.durationMonths += months;
        membership.totalPrice += Number(additionalPrice) || 0;
        if (membership.status !== MEMBERSHIP_STATUS.CANCELLED) {
            membership.status = MEMBERSHIP_STATUS.ACTIVE;
        }

        const saved = await membership.save();
        return res.status(200).json({
            success: true,
            message: `Gia hạn thành công. Hạn mới: ${new Date(saved.endDate).toLocaleDateString('vi-VN')}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi gia hạn gói hội viên V2',
            error: error.message
        });
    }
};

const cancelMembership = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }
        if (membership.status === MEMBERSHIP_STATUS.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Gói hội viên này đã bị hủy trước đó!'
            });
        }

        membership.status = MEMBERSHIP_STATUS.CANCELLED;
        if (membership.paymentStatus === PAYMENT_STATUS.PENDING) {
            membership.paymentStatus = PAYMENT_STATUS.CANCELLED;
        }
        const saved = await membership.save();

        return res.status(200).json({
            success: true,
            message: 'Đã hủy gói hội viên V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi hủy gói hội viên V2',
            error: error.message
        });
    }
};

const confirmPayment = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }

        const { paymentMethod } = req.body;
        membership.paymentStatus = PAYMENT_STATUS.PAID;
        membership.paidAt = new Date();
        if (paymentMethod && Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
            membership.paymentMethod = paymentMethod;
        }
        if (membership.status !== MEMBERSHIP_STATUS.CANCELLED) {
            membership.status = computeStatus(membership);
        }

        const saved = await membership.save();
        return res.status(200).json({
            success: true,
            message: 'Xác nhận thanh toán gói hội viên V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xác nhận thanh toán gói hội viên V2',
            error: error.message
        });
    }
};

const deductPtSession = async (req, res) => {
    try {
        const membership = await UserPackageV2.findById(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }
        if (!isActive(membership)) {
            return res.status(400).json({
                success: false,
                message: 'Gói hội viên không còn hiệu lực!'
            });
        }
        if (membership.sessionsLeft <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Đã dùng hết số buổi PT của gói này!'
            });
        }

        membership.usedSessions += 1;
        const saved = await membership.save();

        return res.status(200).json({
            success: true,
            message: `Đã trừ 1 buổi PT. Còn lại ${saved.sessionsLeft} buổi`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi trừ buổi PT V2',
            error: error.message
        });
    }
};

const refreshMembershipStatuses = async (req, res) => {
    try {
        const result = await refreshStatuses();
        return res.status(200).json({
            success: true,
            message: `Đã kiểm tra ${result.checked} gói hội viên, cập nhật ${result.updated} gói`,
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật trạng thái gói hội viên V2',
            error: error.message
        });
    }
};

const deleteMembership = async (req, res) => {
    try {
        const membership = await UserPackageV2.findByIdAndDelete(req.params.id);
        if (!membership) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói hội viên V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Xóa gói hội viên V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa gói hội viên V2',
            error: error.message
        });
    }
};

const getMembershipMeta = async (req, res) => {
    try {
        const statuses = Object.values(MEMBERSHIP_STATUS).map(key => ({
            key,
            label: MEMBERSHIP_STATUS_LABELS[key]
        }));
        const paymentStatuses = Object.values(PAYMENT_STATUS).map(key => ({
            key,
            label: PAYMENT_STATUS_LABELS[key]
        }));
        const paymentMethods = Object.values(PAYMENT_METHOD).map(key => ({
            key,
            label: PAYMENT_METHOD_LABELS[key]
        }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách trạng thái gói hội viên V2 thành công',
            data: { statuses, paymentStatuses, paymentMethods }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách trạng thái gói hội viên V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getMembershipList,
    getMembershipSummary,
    getMembershipById,
    getCustomerMemberships,
    registerMembership,
    updateMembership,
    extendMembership,
    cancelMembership,
    confirmPayment,
    deductPtSession,
    refreshMembershipStatuses,
    deleteMembership,
    getMembershipMeta
};
