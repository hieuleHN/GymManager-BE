import mongoose from "mongoose";

// Dùng chung model Location của hệ thống (đã được đăng ký qua locationSchema ESM).
// Nếu nạp module này độc lập, tự tạo model nhẹ trỏ đúng collection 'locations'.
const Location = mongoose.models.Location || mongoose.model("Location", new mongoose.Schema({
    title: String,
    description: String,
    address: String,
    phone: String
}, { collection: "locations", strict: false }));

// ID phòng tập của máy quét: lấy từ token của nhân viên đang đăng nhập.
// Admin / tài khoản không gắn phòng tập -> null (quản lý toàn bộ phòng tập).
// Tài khoản admin (isAdmin) có thể chọn phòng tập cần quản lý qua header X-Location-Id.
export const stationLocationId = (req) => {
    const u = req.user;
    const headerLoc = req.headers && req.headers["x-location-id"];
    if (u && u.isAdmin && headerLoc && headerLoc !== "all" && headerLoc !== "undefined") {
        return headerLoc;
    }
    return (u && u.isStaff && u.locationId) ? u.locationId : null;
};

// Lấy tên hiển thị của phòng tập (ưu tiên title, fallback address)
export const getClubName = async (locationId) => {
    if (!locationId) return "chưa rõ";
    try {
        const loc = await Location.findById(locationId).lean();
        return (loc && (loc.title || loc.address)) || "chưa rõ";
    } catch (err) {
        return "chưa rõ";
    }
};

// Kiểm tra xung đột phòng tập. Trả về { clubName } nếu khác phòng tập (cần chặn),
// trả về null nếu cùng phòng tập / không xác định / người chưa gán phòng tập.
export const clubConflict = (personLocationId, stationLocationId, clubNameOverride) => {
    if (!stationLocationId || !personLocationId) return null;
    if (String(personLocationId) === String(stationLocationId)) return null;
    return { clubName: clubNameOverride || personLocationId };
};

// Bộ lọc dùng chung: khi đã biết phòng tập của người đăng nhập thì chỉ lấy dữ liệu
// của phòng tập đó + dữ liệu chưa gán phòng tập (null/thiếu) để không làm mất dữ liệu cũ.
export const dataFilter = (req) => {
    const loc = stationLocationId(req);
    if (!loc) return {};
    return { locationId: { $in: [loc, null] } };
};

export default { Location, stationLocationId, getClubName, clubConflict, dataFilter };
