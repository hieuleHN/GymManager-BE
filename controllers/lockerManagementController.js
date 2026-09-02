import { LockerV2, LOCKER_STATUS } from "../models/lockerManagementModel.js";
import { stationLocationId } from "../services/clubService.js";
import Customer from "../models/schemas/customerSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";

const normalizePrefix = (prefix) => {
    const s = String(prefix || "").trim().replace(/-+$/, "");
    return s || "LK";
};

export const validateLockerCode = (code) => {
    if (!code || typeof code !== "string") return false;
    return /^LK?-\d{3,4}$/i.test(code.trim());
};

// Tủ thuộc phòng tập khác với phòng tập hiện tại (máy quét) thì không được phép thao tác
const ensureOwned = (locker, loc) => {
    if (loc && locker && locker.locationId && String(locker.locationId) !== String(loc)) {
        return false;
    }
    return true;
};

export const formatLockerStatus = (status) => {
    const statusMap = {
        AVAILABLE: "Trống",
        OCCUPIED: "Đang sử dụng",
        MAINTENANCE: "Bảo trì / Hỏng",
        RESERVED: "Đã đặt trước"
    };
    return statusMap[status?.toUpperCase()] || "Không xác định";
};

export const getLockerUsageRate = (totalLockers, occupiedLockers) => {
    if (!totalLockers || totalLockers <= 0) return 0;
    return Math.round((occupiedLockers / totalLockers) * 100);
};

// Sinh danh sách mã tủ tiếp theo cho một prefix: bù số trống trong dãy hiện có,
// không còn số trống thì tăng tiếp từ số lớn nhất. Mã tủ được tính trong phạm vi phòng tập.
export const computeNextCodes = async (prefix, count, locationId) => {
    const p = normalizePrefix(prefix);
    const q = locationId ? { locationId } : {};
    const all = await LockerV2.find(q).select("lockerNumber").lean();
    const used = new Set();
    let min = Infinity;
    let hasAny = false;
    let width = 3;
    for (const doc of all) {
        const match = String(doc.lockerNumber || "").trim().match(/^(.*?)(\d+)$/);
        if (!match) continue;
        const codePrefix = match[1].replace(/-+$/, "");
        if (codePrefix !== p) continue;
        const num = parseInt(match[2], 10);
        used.add(num);
        hasAny = true;
        if (num < min) min = num;
        width = match[2].length;
    }
    const n = Math.max(1, parseInt(count, 10) || 1);
    const numbers = [];
    if (!hasAny) {
        for (let i = 0; i < n; i++) numbers.push(i + 1);
    } else {
        let candidate = min;
        while (numbers.length < n) {
            if (!used.has(candidate)) numbers.push(candidate);
            candidate += 1;
        }
    }
    return numbers.map(num => `${p}-${String(num).padStart(width, "0")}`);
};

// GET /api/v2/lockers - Danh sách tủ đồ (lọc theo phòng tập hiện tại nếu có)
export const list = async (req, res) => {
    try {
        const q = {};
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;
        const lockers = await LockerV2.find(q).sort({ lockerNumber: 1 });
        const total = lockers.length;
        const occupied = lockers.filter(l => l.status === LOCKER_STATUS.OCCUPIED).length;
        const maintenance = lockers.filter(l => l.status === LOCKER_STATUS.MAINTENANCE).length;
        const available = total - occupied - maintenance;
        return res.status(200).json({
            success: true,
            message: "Lấy danh sách tủ đồ thành công",
            data: lockers,
            stats: {
                total,
                occupied,
                maintenance,
                available,
                usageRate: `${getLockerUsageRate(total, occupied)}%`
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách tủ đồ", error: error.message });
    }
};

// GET /api/v2/lockers/next?prefix=LK&count=5 - Mã tủ tiếp theo (preview)
export const getNext = async (req, res) => {
    try {
        const { prefix = "LK", count = 5 } = req.query;
        const codes = await computeNextCodes(prefix, count, stationLocationId(req));
        return res.status(200).json({ success: true, data: codes });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy mã tủ tiếp theo", error: error.message });
    }
};

// POST /api/v2/lockers/row - Tạo dãy tủ mới { prefix, zone, count }
export const createRow = async (req, res) => {
    try {
        const { prefix, zone, count, rowName } = req.body;
        const p = normalizePrefix(prefix);
        const n = Math.max(1, parseInt(count, 10) || 1);
        const loc = stationLocationId(req);
        const codes = await computeNextCodes(p, n, loc);
        const docs = codes.map(lockerNumber => ({
            lockerNumber,
            prefix: p,
            zone: ["NAM", "NU", "VIP"].includes(zone) ? zone : "NAM",
            locationId: loc,
            note: rowName ? String(rowName).trim() : ""
        }));
        const created = await LockerV2.insertMany(docs);
        return res.status(201).json({
            success: true,
            message: `Đã thêm dãy tủ "${p}" với ${created.length} tủ`,
            data: created
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi thêm dãy tủ", error: error.message });
    }
};

// POST /api/v2/lockers/add - Thêm tủ vào dãy đã có { prefix, zone, count, status }
export const addLockers = async (req, res) => {
    try {
        const { prefix, zone, count, status } = req.body;
        const p = normalizePrefix(prefix);
        const n = Math.max(1, parseInt(count, 10) || 1);
        const loc = stationLocationId(req);
        const codes = await computeNextCodes(p, n, loc);
        const targetStatus = Object.values(LOCKER_STATUS).includes(status) ? status : LOCKER_STATUS.AVAILABLE;
        // Kế thừa tên dãy (note) từ các tủ cùng dãy để hiển thị tên dãy nhất quán
        const locFilter = loc ? { locationId: loc } : {};
        const existing = await LockerV2.findOne({ prefix: p, ...locFilter }).select("note").lean();
        const note = (existing && existing.note) || "";
        const docs = codes.map(lockerNumber => ({
            lockerNumber,
            prefix: p,
            zone: ["NAM", "NU", "VIP"].includes(zone) ? zone : "NAM",
            locationId: loc,
            status: targetStatus,
            note
        }));
        const created = await LockerV2.insertMany(docs);
        return res.status(201).json({
            success: true,
            message: `Đã thêm ${created.length} tủ ${p}`,
            data: created
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi thêm tủ", error: error.message });
    }
};

const clearMaintenance = (locker) => {
    locker.maintenanceType = "";
    locker.maintenanceDescription = "";
    locker.maintenanceImage = "";
    locker.maintenanceAt = null;
};

// PATCH /api/v2/lockers/:id - Cập nhật trạng thái / ghi chú / báo cáo bảo trì
export const update = async (req, res) => {
    try {
        const { status, note } = req.body;
        const locker = await LockerV2.findById(req.params.id);
        if (!locker) return res.status(404).json({ success: false, message: "Không tìm thấy tủ!" });
        if (!ensureOwned(locker, stationLocationId(req))) {
            return res.status(403).json({ success: false, message: "Tủ này thuộc phòng tập khác!" });
        }
        if (status && Object.values(LOCKER_STATUS).includes(status)) {
            const prevStatus = locker.status;
            locker.status = status;
            if (status === LOCKER_STATUS.AVAILABLE) {
                locker.previousStatus = null;
                locker.assignedType = null;
                locker.assignedName = "";
                locker.assignedPhone = "";
                locker.assignedAt = null;
                locker.rentalDays = 0;
                locker.rentedAt = null;
                clearMaintenance(locker);
            }
            if (status === LOCKER_STATUS.OCCUPIED) {
                locker.previousStatus = null;
                clearMaintenance(locker);
            }
            if (status === LOCKER_STATUS.MAINTENANCE) {
                // Nhớ trạng thái trước khi bảo trì để khi hoàn tất sẽ quay lại đúng trạng thái đó.
                // Giữ nguyên thông tin người đang dùng (nếu tủ đang được sử dụng) để khôi phục sau bảo trì.
                if (prevStatus !== LOCKER_STATUS.MAINTENANCE) {
                    locker.previousStatus = prevStatus;
                    locker.maintenanceAt = new Date();
                }
                if (req.body.maintenanceType !== undefined) locker.maintenanceType = String(req.body.maintenanceType || "").trim();
                if (req.body.maintenanceDescription !== undefined) locker.maintenanceDescription = String(req.body.maintenanceDescription || "").trim();
                if (req.body.maintenanceImage !== undefined) locker.maintenanceImage = String(req.body.maintenanceImage || "").trim();
            }
        } else if (locker.status === LOCKER_STATUS.MAINTENANCE) {
            // Vẫn đang bảo trì, cập nhật báo cáo mà không reset thời gian bắt đầu
            if (req.body.maintenanceType !== undefined) locker.maintenanceType = String(req.body.maintenanceType || "").trim();
            if (req.body.maintenanceDescription !== undefined) locker.maintenanceDescription = String(req.body.maintenanceDescription || "").trim();
            if (req.body.maintenanceImage !== undefined) locker.maintenanceImage = String(req.body.maintenanceImage || "").trim();
        }
        if (note !== undefined) locker.note = note;
        await locker.save();
        return res.json({ success: true, message: "Cập nhật tủ thành công", data: locker });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi cập nhật tủ", error: error.message });
    }
};

// POST /api/v2/lockers/:id/assign - Gán tủ cho hội viên/nhân viên { personType, name, phone, rentalDays, note }
// Luồng thuê tủ (có rentalDays) -> trạng thái ĐANG THUÊ (lưu rentalDays/rentedAt giống luồng hội viên Services)
// Luồng mượn trong ngày (không rentalDays) -> trạng thái ĐANG SỬ DỤNG
export const assign = async (req, res) => {
    try {
        const { personType, name, phone, rentalDays, note } = req.body;
        const locker = await LockerV2.findById(req.params.id);
        if (!locker) return res.status(404).json({ success: false, message: "Không tìm thấy tủ!" });
        if (!ensureOwned(locker, stationLocationId(req))) {
            return res.status(403).json({ success: false, message: "Tủ này thuộc phòng tập khác!" });
        }
        if (locker.status === LOCKER_STATUS.OCCUPIED) {
            return res.status(400).json({ success: false, message: `Tủ ${locker.lockerNumber} đã có người sử dụng!` });
        }
        if (locker.status === LOCKER_STATUS.MAINTENANCE) {
            return res.status(400).json({ success: false, message: `Tủ ${locker.lockerNumber} đang bảo trì!` });
        }
        // Phân biệt thuê tủ (có rentalDays) vs sử dụng trong ngày (không rentalDays)
        const days = parseInt(rentalDays, 10);
        const isRental = Number.isFinite(days) && days > 0;

        locker.status = LOCKER_STATUS.OCCUPIED;
        locker.previousStatus = null;
        locker.assignedType = personType === "STAFF" ? "STAFF" : "MEMBER";
        locker.assignedName = String(name || "").trim();
        locker.assignedPhone = String(phone || "").trim();
        locker.assignedAt = new Date();
        if (isRental) {
            locker.rentalDays = Math.min(20, Math.max(1, days));
            locker.rentedAt = locker.assignedAt;
        } else {
            locker.rentalDays = 0;
            locker.rentedAt = null;
        }
        if (note !== undefined) locker.note = String(note || "").trim();
        clearMaintenance(locker);
        await locker.save();

        // Ghi lại tủ đồ đang dùng vào ca điểm danh đang mở hôm nay của hội viên (nếu có)
        if (locker.assignedType === "MEMBER" && (locker.assignedPhone || locker.assignedName)) {
            try {
                const cust = await Customer.findOne({
                    $or: [
                        { phone: locker.assignedPhone || "__none__" },
                        { fullName: locker.assignedName || "__none__" }
                    ]
                });
                if (cust) {
                    const now = new Date();
                    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                    const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    await CheckIn.updateMany(
                        {
                            customerId: cust._id,
                            checkInTime: { $gte: startDay, $lte: endDay },
                            checkOutTime: null
                        },
                        { $set: { lockerId: locker._id, lockerNumber: locker.lockerNumber } }
                    );
                }
            } catch (e) { /* không chặn luồng gán tủ khi ghi thiếu thông tin tủ */ }
        }

        const isRentMsg = isRental ? ` đã thuê tủ ${locker.lockerNumber} ${locker.rentalDays} ngày` : `Đã gán tủ ${locker.lockerNumber} cho ${locker.assignedName || "khách hàng"}`;
        return res.json({
            success: true,
            message: isRental ? `Đã cho thuê tủ ${locker.lockerNumber} cho ${locker.assignedName || "khách hàng"} ${locker.rentalDays} ngày` : `Đã gán tủ ${locker.lockerNumber} cho ${locker.assignedName || "khách hàng"}`,
            data: locker
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi gán tủ", error: error.message });
    }
};

// POST /api/v2/lockers/:id/release - Trả tủ về trạng thái trống
export const release = async (req, res) => {
    try {
        const locker = await LockerV2.findById(req.params.id);
        if (!locker) return res.status(404).json({ success: false, message: "Không tìm thấy tủ!" });
        if (!ensureOwned(locker, stationLocationId(req))) {
            return res.status(403).json({ success: false, message: "Tủ này thuộc phòng tập khác!" });
        }
        locker.status = LOCKER_STATUS.AVAILABLE;
        locker.previousStatus = null;
        locker.assignedType = null;
        locker.assignedName = "";
        locker.assignedPhone = "";
        locker.assignedAt = null;
        locker.rentalDays = 0;
        locker.rentedAt = null;
        clearMaintenance(locker);
        await locker.save();
        return res.json({
            success: true,
            message: `Tủ ${locker.lockerNumber} đã mở khóa và trả về trạng thái trống`,
            data: locker
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi trả tủ", error: error.message });
    }
};

// POST /api/v2/lockers/:id/complete-maintenance - Hoàn tất bảo trì:
// quay về trạng thái trước khi bảo trì (đang sử dụng -> đang sử dụng, trống -> trống)
export const completeMaintenance = async (req, res) => {
    try {
        const locker = await LockerV2.findById(req.params.id);
        if (!locker) return res.status(404).json({ success: false, message: "Không tìm thấy tủ!" });
        if (!ensureOwned(locker, stationLocationId(req))) {
            return res.status(403).json({ success: false, message: "Tủ này thuộc phòng tập khác!" });
        }
        if (locker.status !== LOCKER_STATUS.MAINTENANCE) {
            return res.status(400).json({ success: false, message: `Tủ ${locker.lockerNumber} không đang bảo trì!` });
        }
        const target = locker.previousStatus === LOCKER_STATUS.OCCUPIED ? LOCKER_STATUS.OCCUPIED : LOCKER_STATUS.AVAILABLE;
        locker.status = target;
        locker.previousStatus = null;
        if (target === LOCKER_STATUS.AVAILABLE) {
            locker.assignedType = null;
            locker.assignedName = "";
            locker.assignedPhone = "";
            locker.assignedAt = null;
            locker.rentalDays = 0;
            locker.rentedAt = null;
        }
        clearMaintenance(locker);
        await locker.save();
        const message = target === LOCKER_STATUS.OCCUPIED
            ? `Đã hoàn tất bảo trì, tủ ${locker.lockerNumber} quay về trạng thái đang sử dụng`
            : `Đã hoàn tất bảo trì, tủ ${locker.lockerNumber} quay về trạng thái trống`;
        return res.json({ success: true, message, data: locker });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi hoàn tất bảo trì", error: error.message });
    }
};

// DELETE /api/v2/lockers/:id - Xóa một tủ
export const remove = async (req, res) => {
    try {
        const locker = await LockerV2.findById(req.params.id);
        if (!locker) return res.status(404).json({ success: false, message: "Không tìm thấy tủ!" });
        if (!ensureOwned(locker, stationLocationId(req))) {
            return res.status(403).json({ success: false, message: "Tủ này thuộc phòng tập khác!" });
        }
        await LockerV2.findByIdAndDelete(locker._id);
        return res.json({ success: true, message: "Đã xóa tủ!", data: locker });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi xóa tủ", error: error.message });
    }
};

// DELETE /api/v2/lockers/row/:prefix - Xóa toàn bộ dãy tủ theo prefix (trong phạm vi phòng tập)
export const removeRow = async (req, res) => {
    try {
        const prefix = normalizePrefix(req.params.prefix);
        const q = { prefix };
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;
        const result = await LockerV2.deleteMany(q);
        return res.json({ success: true, message: `Đã xóa ${result.deletedCount} tủ của dãy "${prefix}"` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi xóa dãy tủ", error: error.message });
    }
};

// GET /api/v2/lockers/status - Trạng thái tổng quan (trong phạm vi phòng tập)
export const statusOverview = async (req, res) => {
    try {
        const q = {};
        const loc = stationLocationId(req);
        if (loc) q.locationId = loc;
        const lockers = await LockerV2.find(q).select("status").lean();
        const total = lockers.length;
        const occupied = lockers.filter(l => l.status === LOCKER_STATUS.OCCUPIED).length;
        const maintenance = lockers.filter(l => l.status === LOCKER_STATUS.MAINTENANCE).length;
        const available = total - occupied - maintenance;
        return res.status(200).json({
            success: true,
            message: "Lấy thông tin trạng thái tủ đồ thành công",
            data: {
                total,
                occupied,
                maintenance,
                available,
                usageRate: `${getLockerUsageRate(total, occupied)}%`
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy thông tin trạng thái tủ đồ", error: error.message });
    }
};
