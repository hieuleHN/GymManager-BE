import { subscribePackage, getAvailablePackagesByUserId } from '../models/userPackageModel.js';

// Controller 1: Hiển thị danh sách gói
export const getAvailablePackagesForUser = (req, res) => {
  const userId = req.user.id; 

  getAvailablePackagesByUserId(userId, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách gói tập: ' + err.message });
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Hiện tại cơ sở của bạn chưa được phân phối dịch vụ hoặc gói tập nào!' });
    }

    // Gộp dữ liệu (Group by Service) tạo cấu trúc JSON đẹp
    const servicesMap = {};

    rows.forEach(row => {
      if (!servicesMap[row.service_id]) {
        servicesMap[row.service_id] = {
          service_id: row.service_id,
          service_name: row.service_name,
          packages: [] 
        };
      }

      servicesMap[row.service_id].packages.push({
        package_id: row.package_id,
        package_name: row.package_name,
        price: row.price,
        description: row.description,
        duration_days: row.duration_days
      });
    });

    const finalData = Object.values(servicesMap);

    res.status(200).json({
      message: 'Tải danh sách dịch vụ và gói tập thành công!',
      data: finalData
    });
  });
};

// Controller 2: Xử lý mua gói
export const buyPackage = (req, res) => {
  const { package_id } = req.body;
  const userId = req.user.id; 

  if (!package_id) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ID gói tập (package_id) để thanh toán!' });
  }

  // Gọi hàm Model (đã tích hợp tự động cập nhật 2 bảng qua Transaction)
  subscribePackage(userId, package_id, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Xử lý đăng ký gói tập thất bại: ' + err.message });
    }

    res.status(201).json({
      message: 'Giao dịch thanh toán thành công! Gói tập và dịch vụ cơ sở đã được kích hoạt tự động.',
      userPackageId: result.insertId
    });
  });
};