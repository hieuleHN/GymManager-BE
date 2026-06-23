import {
  createRegistration,
  getUserPackages,
  getRegistrationById,
  cancelRegistrationById,
  getAllRegistrations,
  updatePaymentStatus,
  updatePaymentMethod,
} from "../models/userPackageModel.js";
import Package from "../models/schemas/packageSchema.js";
import Customer from "../models/schemas/customerSchema.js";

export const registerPackage = (req, res) => {
  const customer_id = req.user.id;
  const {
    package_id,
    locationId,
    duration_months,
    total_price,
    signature,
    payment_method,
  } = req.body;

  if (!package_id || !locationId || !duration_months || !total_price) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp đầy đủ thông tin đăng ký!" });
  }

  if (!signature || !signature.trim()) {
    return res
      .status(400)
      .json({ error: "Vui lòng ký tên (chữ ký điện tử) để hoàn tất đăng ký!" });
  }

  Package.findById(package_id)
    .exec()
    .then((pkg) => {
      if (!pkg)
        return res.status(404).json({ error: "Gói tập không tồn tại!" });
      if (!pkg.is_active)
        return res.status(400).json({ error: "Gói tập hiện không khả dụng!" });

      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);

      const registrationData = {
        customer_id,
        package_id,
        locationId,
        duration_months,
        total_price,
        signature,
        start_date,
        end_date,
        payment_method,
      };

      createRegistration(registrationData, (err, result) => {
        if (err)
          return res.status(500).json({
            error: "Lỗi hệ thống khi đăng ký gói tập: " + err.message,
          });
        res.status(201).json({
          message: "Đăng ký gói tập thành công!",
          registration: {
            id: result._id,
            package_id: result.package_id,
            start_date: result.start_date,
            end_date: result.end_date,
            status: result.status,
            payment_status: result.payment_status,
            payment_method: result.payment_method,
          },
        });
      });
    })
    .catch((err) =>
      res.status(500).json({ error: "Lỗi hệ thống: " + err.message }),
    );
};

export const listMyPackages = (req, res) => {
  const customer_id = req.user.id;
  getUserPackages(customer_id, (err, registrations) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Lỗi lấy danh sách gói tập: " + err.message });
    res.status(200).json(registrations);
  });
};

export const getRegistrationDetail = (req, res) => {
  const { id } = req.params;
  getRegistrationById(id, (err, reg) => {
    if (err)
      return res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    if (!reg) return res.status(404).json({ error: "Không tìm thấy đăng ký!" });
    res.status(200).json(reg);
  });
};

export const cancelRegistration = (req, res) => {
  const { id } = req.params;
  cancelRegistrationById(id, (err, result) => {
    if (err)
      return res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    if (!result)
      return res.status(404).json({ error: "Không tìm thấy đăng ký!" });
    res
      .status(200)
      .json({ message: "Đã hủy đăng ký gói tập!", registration: result });
  });
};

export const listAllRegistrations = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const filters = {
    payment_status: req.query.payment_status || null,
    locationId: req.query.locationId || null,
    status: req.query.status || null,
  };
  Object.keys(filters).forEach((k) => {
    if (!filters[k]) delete filters[k];
  });

  getAllRegistrations(page, limit, filters, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Lỗi lấy danh sách đăng ký: " + err.message });
    res.status(200).json(result);
  });
};

export const confirmPayment = (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;
  const confirmed_by = req.user.id;

  if (
    !payment_status ||
    !["đã thanh toán", "đã hủy"].includes(payment_status)
  ) {
    return res
      .status(400)
      .json({ error: "Trạng thái thanh toán không hợp lệ!" });
  }

  updatePaymentStatus(id, { payment_status, confirmed_by }, (err, result) => {
    if (err) {
      if (err.message === "NotFound")
        return res.status(404).json({ error: "Không tìm thấy đăng ký!" });
      return res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
    const msg =
      payment_status === "đã thanh toán"
        ? "Xác nhận thanh toán thành công!"
        : "Đã hủy thanh toán!";
    res.status(200).json({ message: msg, registration: result });
  });
};

export const setPaymentMethod = (req, res) => {
  const { id } = req.params;
  const customer_id = req.user.id;
  const { payment_method } = req.body;

  if (!payment_method) {
    return res
      .status(400)
      .json({ error: "Vui lòng chọn phương thức thanh toán!" });
  }

  updatePaymentMethod(id, customer_id, payment_method, (err, result) => {
    if (err) {
      if (err.message === "NotFound")
        return res.status(404).json({ error: "Không tìm thấy đăng ký!" });
      return res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
    }
    res.status(200).json({
      message: "Đã cập nhật phương thức thanh toán!",
      registration: result,
    });
  });
};

export const createRenewOrUpgrade = (req, res) => {
  const customer_id = req.user.id;

  // Lấy thêm trường current_end_date từ Frontend truyền xuống
  const {
    package_id,
    locationId,
    duration_months,
    total_price,
    action_type,
    current_end_date,
  } = req.body;

  // Ràng buộc kiểm tra dữ liệu đầu vào (Validation)
  if (!package_id) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin mã gói tập (package_id)!" });
  }
  if (!duration_months || duration_months <= 0) {
    return res
      .status(400)
      .json({ error: "Thời gian áp dụng phải từ 1 tháng trở lên!" });
  }
  if (total_price === undefined || total_price < 0) {
    return res
      .status(400)
      .json({ error: "Tổng số tiền hóa đơn không hợp lệ!" });
  }
  if (!action_type || !["renew", "upgrade"].includes(action_type)) {
    return res
      .status(400)
      .json({ error: "Loại thao tác hệ thống không xác định!" });
  }

  // 1. TÍNH TOÁN LOGIC NỐI TIẾP THỜI GIAN
  let start_date = new Date();

  // Nếu là Gia hạn và gói cũ vẫn chưa hết hạn, thì lấy ngày kết thúc cũ làm ngày bắt đầu mới
  if (action_type === "renew" && current_end_date) {
    const oldEnd = new Date(current_end_date);
    if (oldEnd > start_date) {
      start_date = oldEnd;
    }
  }

  // 2. TÍNH NGÀY KẾT THÚC = Ngày bắt đầu + Số tháng gia hạn
  const end_date = new Date(start_date);
  end_date.setMonth(end_date.getMonth() + duration_months);

  // Khởi tạo cấu trúc dữ liệu bản ghi lưu trữ
  const registrationData = {
    customer_id,
    package_id,
    locationId,
    duration_months,
    total_price,
    payment_status: "chờ thanh toán",
    status: "đang hoạt động",
    start_date,
    end_date,
  };

  createRegistration(registrationData, (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Lỗi truy vấn cơ sở dữ liệu: " + err.message });
    }
    res.status(201).json({
      message: `Khởi tạo yêu cầu ${action_type === "renew" ? "Gia hạn" : "Nâng cấp"} thành công!`,
      registration: result,
    });
  });
};
