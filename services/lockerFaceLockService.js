import mongoose from "mongoose";
import { LockerV2, LOCKER_STATUS } from "../models/lockerManagementModel.js";

// Tính ngày hết hạn thuê tủ
export const getLockerExpiry = (locker) => {
    if (!locker?.rentedAt || !locker?.rentalDays) return null;
    const end = new Date(locker.rentedAt);
    if (Number.isNaN(end.getTime())) return null;
    end.setDate(end.getDate() + (locker.rentalDays || 0));
    return end;
};

export const isLockerOverdue = (locker, now = new Date()) => {
    if (!locker) return false;
    // Quá hạn = đang ở trạng thái chờ trả chìa khóa
    if (locker.status === LOCKER_STATUS.AWAIT_KEY_RETURN) return true;
    // Dự phòng: OCCUPIED nhưng đã lố rentalDays mà cron chưa kịp chạy
    if (locker.status === LOCKER_STATUS.OCCUPIED && locker.rentalDays > 0 && locker.rentedAt) {
        const end = getLockerExpiry(locker);
        if (end && now >= end) return true;
    }
    return false;
};

// Tìm tất cả tủ quá hạn của 1 hội viên.
// Match ưu tiên assignedCustomerId, fallback phone/fullName để tương thích dữ liệu cũ.
export const findOverdueLockersForCustomer = async (customer) => {
    if (!customer) return [];
    const or = [];
    if (customer._id) {
        or.push({ assignedCustomerId: customer._id });
        // assignedCustomerId có thể lưu dạng string cũ
        or.push({ assignedCustomerId: String(customer._id) });
    }
    if (customer.phone) {
        or.push({ assignedPhone: customer.phone });
    }
    if (customer.fullName) {
        // Chỉ match theo tên khi không có phone để tránh nhầm người trùng tên,
        // nhưng vẫn hỗ trợ dữ liệu cũ chỉ lưu tên.
        or.push({ assignedName: customer.fullName });
    }
    if (!or.length) return [];
    const candidates = await LockerV2.find({
        $or: or,
        status: { $in: [LOCKER_STATUS.AWAIT_KEY_RETURN, LOCKER_STATUS.OCCUPIED] },
    }).lean();
    const now = new Date();
    return candidates.filter((l) => isLockerOverdue(l, now)).map((l) => ({
        ...l,
        expiryDate: getLockerExpiry(l),
        overdueDays: l.rentedAt && l.rentalDays
            ? Math.max(0, Math.floor((now.getTime() - getLockerExpiry(l).getTime()) / 86400000))
            : 0,
    }));
};

// Resolve Customer từ thông tin gán tủ (phone -> name)
export const resolveCustomerForLocker = async (CustomerModel, { name, phone }) => {
    try {
        const p = String(phone || "").trim();
        const n = String(name || "").trim();
        if (p) {
            const byPhone = await CustomerModel.findOne({ phone: p }).select("_id").lean();
            if (byPhone) return byPhone._id;
        }
        if (n) {
            const byName = await CustomerModel.findOne({ fullName: n }).select("_id").lean();
            if (byName) return byName._id;
        }
    } catch (e) { /* bỏ qua, không chặn luồng gán tủ */ }
    return null;
};

export const buildFaceLockError = (customerName, overdueLockers) => {
    const codes = overdueLockers.map((l) => l.lockerNumber).join(", ");
    const first = overdueLockers[0];
    const expiry = first?.expiryDate
        ? new Date(first.expiryDate).toLocaleDateString("vi-VN")
        : "";
    return `FaceID của ${customerName || "hội viên"} đang bị KHÓA do quá hạn thuê tủ ${codes}${expiry ? ` (hết hạn ${expiry})` : ""}. Vui lòng trả chìa khóa/gia hạn tủ để mở lại FaceID!`;
};
