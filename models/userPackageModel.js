import UserPackage from "./schemas/userPackageSchema.js";

export const createRegistration = async (data, callback) => {
  try {
    // Nhận thêm status và payment_status được truyền từ Controller xuống
    const {
      customer_id,
      package_id,
      locationId,
      duration_months,
      total_price,
      signature,
      start_date,
      end_date,
      payment_method,
      status,
      payment_status,
    } = data;

    const registration = new UserPackage({
      customer_id,
      package_id,
      locationId,
      duration_months,
      total_price,
      signature,
      start_date,
      end_date,
      payment_method: payment_method || "",
      // Nếu Controller có chỉ định rõ trạng thái (như 'chờ thanh toán') thì ưu tiên dùng luôn
      payment_status:
        payment_status || (payment_method ? "chờ thanh toán" : "đã thanh toán"),
      status: status || (payment_method ? "chờ thanh toán" : "đang hoạt động"),
    });

    const result = await registration.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getUserPackages = async (customerId, callback) => {
  try {
    const registrations = await UserPackage.find({ customer_id: customerId })
      // Chui sâu vào bảng gói tập để lấy thông tin cơ sở gốc phòng hờ hóa đơn bị khuyết dữ liệu
      .populate({
        path: "package_id",
        select: "name unitPrice features durations locationId",
        populate: { path: "locationId", select: "title name address" },
      })
      // Populate trực tiếp cơ sở gắn trên hóa đơn, bắt cả 2 trường title và name để tránh lệch cột DB
      .populate("locationId", "title name address")
      .sort({ createdAt: -1 });
    callback(null, registrations);
  } catch (err) {
    callback(err);
  }
};

export const getRegistrationById = async (id, callback) => {
  try {
    const reg = await UserPackage.findById(id)
      .populate({
        path: "package_id",
        select: "name unitPrice features durations locationId",
        populate: { path: "locationId", select: "title name address" },
      })
      .populate("locationId", "title name address")
      .populate("customer_id", "fullName email phone");
    if (!reg) return callback(null, null);
    callback(null, reg);
  } catch (err) {
    callback(err);
  }
};

export const cancelRegistrationById = async (id, callback) => {
  try {
    const result = await UserPackage.findByIdAndUpdate(
      id,
      { status: "đã hủy", payment_status: "đã hủy" },
      { new: true },
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getAllRegistrations = async (
  page = 1,
  limit = 15,
  filters = {},
  callback,
) => {
  try {
    const filter = {};
    if (filters.payment_status) filter.payment_status = filters.payment_status;
    if (filters.locationId) filter.locationId = filters.locationId;
    if (filters.status) filter.status = filters.status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      UserPackage.find(filter)
        .populate("package_id", "name unitPrice")
        .populate("locationId", "title name address")
        .populate("customer_id", "fullName email phone")
        .populate("confirmed_by", "name")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      UserPackage.countDocuments(filter),
    ]);
    callback(null, {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    callback(err);
  }
};

export const updatePaymentMethod = async (
  id,
  customerId,
  paymentMethod,
  callback,
) => {
  try {
    const result = await UserPackage.findOneAndUpdate(
      { _id: id, customer_id: customerId },
      { payment_method: paymentMethod, payment_status: "chờ thanh toán" },
      { new: true },
    );
    if (!result) return callback(new Error("NotFound"));
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const updatePaymentStatus = async (id, paymentData, callback) => {
  try {
    const { payment_status, confirmed_by } = paymentData;
    const update = {
      payment_status,
      confirmed_by,
      confirmed_at: payment_status === "đã thanh toán" ? new Date() : null,
      payment_date: payment_status === "đã thanh toán" ? new Date() : null,
    };
    if (payment_status === "đã hủy") {
      update.status = "đã hủy";
    }
    const result = await UserPackage.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!result) return callback(new Error("NotFound"));
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
