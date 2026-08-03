const {
    BookingV2,
    BOOKING_STATUS,
    BOOKING_STATUS_LABELS,
    SESSION_TYPE,
    SESSION_TYPE_LABELS,
    PAYMENT_STATUS,
    PAYMENT_STATUS_LABELS,
    TRANSFER_TYPE,
    TRANSFER_TYPE_LABELS,
    TRANSFER_STATUS,
    TRANSFER_STATUS_LABELS
} = require('../models/bookingModel');
const {
    getDayRange,
    toDateKey,
    parseLocalDate,
    toMinutes,
    formatTimeLabel,
    generateBookingCode,
    computeDuration,
    findConflictingBookings,
    filterBooking,
    summarizeBookings,
    buildTrend,
    buildTrainerWorkSlots
} = require('../services/bookingService');
const { UserPackageV2, MEMBERSHIP_STATUS, PAYMENT_STATUS: UP_PAYMENT_STATUS } = require('../models/userPackageModel');
const { StaffV2 } = require('../models/staffModel');
const { CustomerV2 } = require('../models/customerModel');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const populateOptions = () => [
    { path: 'customerId', select: 'fullName phoneNumber email' },
    { path: 'userPackageId', select: 'packageName status endDate' },
    { path: 'trainerId', select: 'fullName phone role' }
];

const getBookingMeta = async (req, res) => {
    try {
        const statuses = Object.values(BOOKING_STATUS).map(key => ({ key, label: BOOKING_STATUS_LABELS[key] }));
        const sessionTypes = Object.values(SESSION_TYPE).map(key => ({ key, label: SESSION_TYPE_LABELS[key] }));
        const paymentStatuses = Object.values(PAYMENT_STATUS).map(key => ({ key, label: PAYMENT_STATUS_LABELS[key] }));
        const transferTypes = Object.values(TRANSFER_TYPE).map(key => ({ key, label: TRANSFER_TYPE_LABELS[key] }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách trạng thái đặt lịch V2 thành công',
            data: { statuses, sessionTypes, paymentStatuses, transferTypes }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách trạng thái đặt lịch V2',
            error: error.message
        });
    }
};

const getBookingList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { status, sessionType, date, search } = req.query;

        const allRecords = await BookingV2.find()
            .populate(populateOptions())
            .sort({ date: -1, startTime: -1 });

        const dayKey = date ? String(date).slice(0, 10) : '';
        const filtered = allRecords.filter(record => {
            if (dayKey && toDateKey(record.date) !== dayKey) return false;
            return filterBooking(record, { status, sessionType, search });
        });

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách lịch đặt V2 thành công',
            data,
            total: filtered.length,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách lịch đặt V2',
            error: error.message
        });
    }
};

const getBookingById = async (req, res) => {
    try {
        const booking = await BookingV2.findById(req.params.id).populate(populateOptions());
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin lịch đặt V2 thành công',
            data: booking
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin lịch đặt V2',
            error: error.message
        });
    }
};

const createBooking = async (req, res) => {
    try {
        const {
            customerId, customerName, customerPhone, userPackageId, packageName,
            sessionType, disciplineName, trainerId, trainerName, date, startTime, endTime,
            note, price, paymentStatus, paymentMethod
        } = req.body;

        if (!customerName || !String(customerName).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên khách hàng!' });
        }
        if (!customerPhone || !String(customerPhone).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại khách hàng!' });
        }
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ ngày và giờ đặt lịch!' });
        }

        const bookingDate = parseLocalDate(date);
        if (!bookingDate) {
            return res.status(400).json({ success: false, message: 'Ngày đặt lịch không hợp lệ!' });
        }
        const startMin = toMinutes(startTime);
        const endMin = toMinutes(endTime);
        if (startMin === null || endMin === null || endMin <= startMin) {
            return res.status(400).json({ success: false, message: 'Khung giờ đặt lịch không hợp lệ!' });
        }

        if (trainerId) {
            const conflicts = await findConflictingBookings({
                trainerId,
                date: bookingDate,
                startTime,
                endTime
            });
            if (conflicts.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `PT đã có lịch "${conflicts[0].bookingCode}" trùng khung giờ!`,
                    data: conflicts
                });
            }
        }

        const bookingCode = await generateBookingCode();
        const booking = await BookingV2.create({
            bookingCode,
            customerId: customerId || null,
            customerName: String(customerName).trim(),
            customerPhone: String(customerPhone).trim(),
            userPackageId: userPackageId || null,
            packageName: packageName || '',
            sessionType: Object.values(SESSION_TYPE).includes(sessionType) ? sessionType : SESSION_TYPE.PERSONAL,
            disciplineName: disciplineName || '',
            trainerId: trainerId || null,
            trainerName: trainerName || '',
            date: bookingDate,
            startTime: String(startTime).trim(),
            endTime: String(endTime).trim(),
            duration: computeDuration(startTime, endTime),
            status: BOOKING_STATUS.PENDING,
            note: note || '',
            price: Number(price) || 0,
            paymentStatus: Object.values(PAYMENT_STATUS).includes(paymentStatus) ? paymentStatus : PAYMENT_STATUS.PENDING,
            paymentMethod: paymentMethod || ''
        });

        return res.status(201).json({
            success: true,
            message: `Đặt lịch thành công với mã ${booking.bookingCode}`,
            data: booking
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo lịch đặt V2',
            error: error.message
        });
    }
};

const updateBooking = async (req, res) => {
    try {
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Không thể sửa lịch đặt đã hoàn thành hoặc đã hủy!'
            });
        }

        const {
            customerName, customerPhone, userPackageId, packageName, sessionType, disciplineName,
            trainerId, trainerName, date, startTime, endTime, note, price, paymentStatus, paymentMethod
        } = req.body;

        if (customerName !== undefined) booking.customerName = String(customerName).trim();
        if (customerPhone !== undefined) booking.customerPhone = String(customerPhone).trim();
        if (userPackageId !== undefined) booking.userPackageId = userPackageId;
        if (packageName !== undefined) booking.packageName = packageName;
        if (sessionType !== undefined && Object.values(SESSION_TYPE).includes(sessionType)) booking.sessionType = sessionType;
        if (disciplineName !== undefined) booking.disciplineName = disciplineName;
        if (trainerId !== undefined) booking.trainerId = trainerId;
        if (trainerName !== undefined) booking.trainerName = trainerName;
        if (note !== undefined) booking.note = note;
        if (price !== undefined) booking.price = Number(price) || 0;
        if (paymentMethod !== undefined) booking.paymentMethod = paymentMethod;
        if (paymentStatus !== undefined && Object.values(PAYMENT_STATUS).includes(paymentStatus)) booking.paymentStatus = paymentStatus;

        const nextDate = date ? parseLocalDate(date) : booking.date;
        const nextStart = startTime !== undefined ? startTime : booking.startTime;
        const nextEnd = endTime !== undefined ? endTime : booking.endTime;

        const startMin = toMinutes(nextStart);
        const endMin = toMinutes(nextEnd);
        if (startMin === null || endMin === null || endMin <= startMin) {
            return res.status(400).json({ success: false, message: 'Khung giờ đặt lịch không hợp lệ!' });
        }

        if (trainerId !== undefined || date !== undefined || startTime !== undefined || endTime !== undefined) {
            const conflicts = await findConflictingBookings({
                trainerId: trainerId !== undefined ? trainerId : booking.trainerId,
                date: nextDate,
                startTime: nextStart,
                endTime: nextEnd,
                excludeId: booking._id
            });
            if (conflicts.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `PT đã có lịch "${conflicts[0].bookingCode}" trùng khung giờ!`,
                    data: conflicts
                });
            }
        }

        if (date !== undefined) booking.date = nextDate;
        if (startTime !== undefined) booking.startTime = String(nextStart).trim();
        if (endTime !== undefined) booking.endTime = String(nextEnd).trim();
        booking.duration = computeDuration(booking.startTime, booking.endTime);

        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật lịch đặt V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật lịch đặt V2',
            error: error.message
        });
    }
};

const deleteBooking = async (req, res) => {
    try {
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa lịch đặt đã hoàn thành!'
            });
        }
        await BookingV2.findByIdAndDelete(booking._id);
        return res.status(200).json({
            success: true,
            message: `Xóa lịch đặt ${booking.bookingCode} thành công`
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa lịch đặt V2',
            error: error.message
        });
    }
};

const confirmBooking = async (req, res) => {
    try {
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.COMPLETED) {
            return res.status(400).json({ success: false, message: 'Lịch đặt đã hoàn thành!' });
        }
        if (booking.status === BOOKING_STATUS.CANCELLED || booking.status === BOOKING_STATUS.REJECTED) {
            return res.status(400).json({ success: false, message: 'Lịch đặt đã bị hủy, không thể xác nhận!' });
        }
        booking.status = BOOKING_STATUS.CONFIRMED;
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: `Đã xác nhận lịch đặt ${booking.bookingCode}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xác nhận lịch đặt V2',
            error: error.message
        });
    }
};

const rejectBooking = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối!' });
        }
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.CANCELLED) {
            return res.status(400).json({ success: false, message: 'Không thể từ chối lịch đã hoàn thành hoặc đã hủy!' });
        }
        booking.status = BOOKING_STATUS.REJECTED;
        booking.rejectionReason = String(reason).trim();
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: `Đã từ chối lịch đặt ${booking.bookingCode}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi từ chối lịch đặt V2',
            error: error.message
        });
    }
};

const cancelBooking = async (req, res) => {
    try {
        const { reason } = req.body;
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.COMPLETED) {
            return res.status(400).json({ success: false, message: 'Lịch đặt đã hoàn thành, không thể hủy!' });
        }
        booking.status = BOOKING_STATUS.CANCELLED;
        if (reason) booking.rejectionReason = String(reason).trim();
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: `Đã hủy lịch đặt ${booking.bookingCode}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi hủy lịch đặt V2',
            error: error.message
        });
    }
};

const completeBooking = async (req, res) => {
    try {
        const { attendanceId, paymentStatus, paymentMethod } = req.body;
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status === BOOKING_STATUS.CANCELLED || booking.status === BOOKING_STATUS.REJECTED) {
            return res.status(400).json({ success: false, message: 'Lịch đặt đã bị hủy, không thể hoàn thành!' });
        }
        booking.status = BOOKING_STATUS.COMPLETED;
        if (attendanceId) booking.attendanceId = attendanceId;
        if (paymentStatus !== undefined && Object.values(PAYMENT_STATUS).includes(paymentStatus)) booking.paymentStatus = paymentStatus;
        if (paymentMethod !== undefined) booking.paymentMethod = paymentMethod;
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: `Đã hoàn thành buổi tập ${booking.bookingCode}`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi hoàn thành lịch đặt V2',
            error: error.message
        });
    }
};

const requestTransfer = async (req, res) => {
    try {
        const { type, toTrainerId, toTrainerName, reason, newDate, newTime } = req.body;
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.PENDING) {
            return res.status(400).json({ success: false, message: 'Chỉ có thể chuyển lịch đang chờ hoặc đã xác nhận!' });
        }

        const transferType = Object.values(TRANSFER_TYPE).includes(type) ? type : '';
        if (!transferType || transferType === TRANSFER_TYPE.NONE) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn loại chuyển lịch!' });
        }
        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do chuyển lịch!' });
        }

        booking.transferType = transferType;
        booking.transferReason = String(reason).trim();
        booking.transferStatus = TRANSFER_STATUS.PENDING_APPROVAL;
        booking.transferNewDate = null;
        booking.transferNewTime = '';
        booking.transferToTrainerId = null;
        booking.transferToTrainerName = '';

        if (transferType === TRANSFER_TYPE.TO_COLLEAGUE) {
            if (!toTrainerId) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn PT nhận chuyển!' });
            }
            booking.transferToTrainerId = toTrainerId;
            booking.transferToTrainerName = toTrainerName || '';
        } else if (transferType === TRANSFER_TYPE.TO_ANOTHER_DAY) {
            const nextDate = parseLocalDate(newDate);
            if (!nextDate || !newTime) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ dời lịch!' });
            }
            const startMin = toMinutes(newTime);
            const endMin = startMin === null ? null : startMin + (booking.duration || 60);
            if (startMin === null) {
                return res.status(400).json({ success: false, message: 'Giờ dời lịch không hợp lệ!' });
            }
            const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            const conflicts = await findConflictingBookings({
                trainerId: booking.trainerId,
                date: nextDate,
                startTime: newTime,
                endTime: newEnd
            });
            if (conflicts.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `PT đã có lịch "${conflicts[0].bookingCode}" trùng khung giờ dời lịch!`
                });
            }
            booking.transferNewDate = nextDate;
            booking.transferNewTime = String(newTime).trim();
        }

        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: 'Đã gửi yêu cầu chuyển lịch, đang chờ duyệt!',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi yêu cầu chuyển lịch V2',
            error: error.message
        });
    }
};

const approveTransfer = async (req, res) => {
    try {
        const { approvedBy } = req.body;
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.transferStatus !== TRANSFER_STATUS.PENDING_APPROVAL) {
            return res.status(400).json({ success: false, message: 'Lịch đặt không có yêu cầu chuyển nào đang chờ duyệt!' });
        }

        booking.transferredFromTrainerId = booking.trainerId;
        booking.transferredFromTrainerName = booking.trainerName;

        if (booking.transferType === TRANSFER_TYPE.TO_COLLEAGUE && booking.transferToTrainerId) {
            booking.trainerId = booking.transferToTrainerId;
            booking.trainerName = booking.transferToTrainerName;
        } else if (booking.transferType === TRANSFER_TYPE.TO_ANOTHER_DAY && booking.transferNewDate) {
            booking.date = booking.transferNewDate;
            booking.startTime = booking.transferNewTime;
            booking.endTime = booking.transferNewTime
                ? (() => {
                    const startMin = toMinutes(booking.transferNewTime);
                    const endMin = startMin + (booking.duration || 60);
                    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
                })()
                : booking.endTime;
        }

        booking.transferStatus = TRANSFER_STATUS.APPROVED;
        booking.transferApprovedBy = approvedBy || null;
        booking.transferApprovedAt = new Date();
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: 'Đã duyệt yêu cầu chuyển lịch!',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi duyệt chuyển lịch V2',
            error: error.message
        });
    }
};

const rejectTransfer = async (req, res) => {
    try {
        const { reason } = req.body;
        const booking = await BookingV2.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch đặt V2!'
            });
        }
        if (booking.transferStatus !== TRANSFER_STATUS.PENDING_APPROVAL) {
            return res.status(400).json({ success: false, message: 'Lịch đặt không có yêu cầu chuyển nào đang chờ duyệt!' });
        }
        booking.transferStatus = TRANSFER_STATUS.REJECTED;
        booking.transferRejectionReason = reason || '';
        const saved = await booking.save();
        return res.status(200).json({
            success: true,
            message: 'Đã từ chối yêu cầu chuyển lịch!',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi từ chối chuyển lịch V2',
            error: error.message
        });
    }
};

const getTrainerAvailability = async (req, res) => {
    try {
        const { trainerId } = req.query;
        if (!trainerId) {
            return res.status(400).json({ success: false, message: 'Thiếu trainerId!' });
        }
        const trainer = await StaffV2.findById(trainerId).select('fullName role workSchedule status');
        if (!trainer) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy PT!' });
        }
        if (trainer.role !== 'PT') {
            return res.status(400).json({ success: false, message: 'Nhân viên này không phải PT!' });
        }

        const dateStr = String(req.query.date || '').slice(0, 10);
        const baseDate = dateStr ? parseLocalDate(dateStr) : new Date();
        if (!baseDate) {
            return res.status(400).json({ success: false, message: 'Ngày không hợp lệ!' });
        }

        const dayOfWeek = baseDate.getDay();
        const { start, end } = getDayRange(baseDate);
        const busyBookings = await BookingV2.find({
            trainerId,
            date: { $gte: start, $lte: end },
            status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] }
        }).select('bookingCode startTime endTime');

        const scheduleSlot = trainer.workSchedule.find(item => Number(item.dayOfWeek) === dayOfWeek);
        if (!scheduleSlot) {
            return res.status(200).json({
                success: true,
                message: 'PT không làm việc vào ngày này!',
                data: { date: toDateKey(baseDate), dayOfWeek, working: false, availableSlots: [], busyBookings }
            });
        }

        const slots = buildTrainerWorkSlots([scheduleSlot]);
        const availableSlots = slots.filter(slot =>
            !busyBookings.some(record =>
                (toMinutes(slot.startTime) < toMinutes(record.endTime)) &&
                (toMinutes(record.startTime) < toMinutes(slot.endTime))
            )
        );

        return res.status(200).json({
            success: true,
            message: 'Lấy lịch rảnh của PT thành công',
            data: {
                trainer: { _id: trainer._id, fullName: trainer.fullName, role: trainer.role },
                date: toDateKey(baseDate),
                dayOfWeek,
                working: true,
                shift: { startTime: scheduleSlot.startTime, endTime: scheduleSlot.endTime },
                availableSlots,
                busyBookings
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch rảnh của PT V2',
            error: error.message
        });
    }
};

const getBookingStats = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const { start } = getDayRange();
        const from = new Date(start);
        from.setDate(from.getDate() - (days - 1));

        const [records, allRecords] = await Promise.all([
            BookingV2.find({ date: { $gte: from } }),
            BookingV2.find()
        ]);

        const summary = summarizeBookings(allRecords);
        const trend = buildTrend(records, days);

        const todayRecords = allRecords.filter(record => toDateKey(record.date) === toDateKey(new Date()));
        const todaySummary = summarizeBookings(todayRecords);

        return res.status(200).json({
            success: true,
            message: 'Lấy thống kê lịch đặt V2 thành công',
            data: {
                ...summary,
                today: todaySummary,
                trend,
                days
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thống kê lịch đặt V2',
            error: error.message
        });
    }
};

const getTodaySchedule = async (req, res) => {
    try {
        const dateStr = String(req.query.date || '').slice(0, 10);
        const baseDate = dateStr ? parseLocalDate(dateStr) : new Date();
        const { start, end } = getDayRange(baseDate);

        const records = await BookingV2.find({
            date: { $gte: start, $lte: end },
            status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING, BOOKING_STATUS.COMPLETED] }
        })
            .populate('trainerId', 'fullName phone')
            .sort({ startTime: 1 });

        return res.status(200).json({
            success: true,
            message: 'Lấy lịch tập trong ngày V2 thành công',
            data: {
                date: toDateKey(baseDate),
                records
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch tập trong ngày V2',
            error: error.message
        });
    }
};

const getMemberBookings = async (req, res) => {
    try {
        const { customerId, phone, status } = req.query;
        const filter = {};
        if (customerId) filter.customerId = customerId;
        if (phone) filter.customerPhone = phone;
        if (!filter.customerId && !filter.customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Cần cung cấp customerId hoặc phone!'
            });
        }
        if (status && status !== 'ALL') filter.status = status;

        const bookings = await BookingV2.find(filter)
            .populate(populateOptions())
            .sort({ date: -1, startTime: -1 });

        return res.status(200).json({
            success: true,
            message: 'Lấy lịch sử đặt lịch của khách hàng V2 thành công',
            data: bookings
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch sử đặt lịch khách hàng V2',
            error: error.message
        });
    }
};

const lookupMember = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !String(phone).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại!' });
        }
        const phoneStr = String(phone).trim();

        const customer = await CustomerV2.findOne({ phoneNumber: phoneStr }).select('fullName phoneNumber email membershipPackage status');
        const memberships = await UserPackageV2.find({
            customerPhone: phoneStr,
            paymentStatus: { $in: [UP_PAYMENT_STATUS.PAID, UP_PAYMENT_STATUS.PENDING] }
        }).sort({ createdAt: -1 }).select('_id packageName status endDate remainingDays startDate');

        if (!customer && memberships.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng với số điện thoại này!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tìm thấy thông tin khách hàng',
            data: {
                customerId: customer ? customer._id : (memberships[0] ? memberships[0].customerId : null),
                customerName: customer ? customer.fullName : (memberships[0] ? memberships[0].customerName : phoneStr),
                customerPhone: phoneStr,
                customerEmail: customer ? customer.email : '',
                memberships: memberships.map(m => ({
                    _id: m._id,
                    packageName: m.packageName,
                    status: m.status,
                    remainingDays: m.remainingDays,
                    endDate: m.endDate,
                    valid: m.status !== MEMBERSHIP_STATUS.CANCELLED && new Date(m.endDate) >= new Date()
                }))
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tra cứu khách hàng V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getBookingMeta,
    getBookingList,
    getBookingById,
    createBooking,
    updateBooking,
    deleteBooking,
    confirmBooking,
    rejectBooking,
    cancelBooking,
    completeBooking,
    requestTransfer,
    approveTransfer,
    rejectTransfer,
    getTrainerAvailability,
    getBookingStats,
    getTodaySchedule,
    getMemberBookings,
    lookupMember
};
