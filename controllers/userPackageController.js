import {
  createRegistration, getUserPackages, getRegistrationById, cancelRegistrationById
} from '../models/userPackageModel.js';
import Package from '../models/schemas/packageSchema.js';
import Customer from '../models/schemas/customerSchema.js';

export const registerPackage = (req, res) => {
  const customer_id = req.user.id;
  const { package_id, locationId, duration_months, total_price, signature } = req.body;

  if (!package_id || !locationId || !duration_months || !total_price) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin đăng ký!' });
  }

  if (!signature || !signature.trim()) {
    return res.status(400).json({ error: 'Vui lòng ký tên (chữ ký điện tử) để hoàn tất đăng ký!' });
  }

  Package.findById(package_id).exec()
    .then(pkg => {
      if (!pkg) return res.status(404).json({ error: 'Gói tập không tồn tại!' });
      if (!pkg.is_active) return res.status(400).json({ error: 'Gói tập hiện không khả dụng!' });

      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);

      const registrationData = {
        customer_id, package_id, locationId,
        duration_months, total_price, signature,
        start_date, end_date
      };

      createRegistration(registrationData, (err, result) => {
        if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký gói tập: ' + err.message });
        res.status(201).json({
          message: 'Đăng ký gói tập thành công!',
          registration: {
            id: result._id,
            package_id: result.package_id,
            start_date: result.start_date,
            end_date: result.end_date,
            status: result.status
          }
        });
      });
    })
    .catch(err => res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message }));
};

export const listMyPackages = (req, res) => {
  const customer_id = req.user.id;

  getUserPackages(customer_id, (err, registrations) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách gói tập: ' + err.message });
    res.status(200).json(registrations);
  });
};

export const getRegistrationDetail = (req, res) => {
  const { id } = req.params;

  getRegistrationById(id, (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    res.status(200).json(reg);
  });
};

export const cancelRegistration = (req, res) => {
  const { id } = req.params;

  cancelRegistrationById(id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!result) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    res.status(200).json({ message: 'Đã hủy đăng ký gói tập!', registration: result });
  });
};
