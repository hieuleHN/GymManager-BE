import { 
  createPackage, 
  getAllPackages, 
  getPackageById, 
  updatePackageById, 
  deletePackageById 
} from '../models/packageModel.js';

// 1. Thêm gói tập mới
export const addPackage = (req, res) => {
  const { name, price, description, duration_days, is_active, service_id } = req.body;

  if (!name || price === undefined || !duration_days || !service_id) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: Tên gói, Giá, Số ngày và ID dịch vụ!' });
  }

  const payload = { name, price, description, duration_days, is_active, service_id };

  createPackage(payload, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi thêm gói tập: ' + err.message });
    res.status(201).json({ 
      message: 'Thêm gói tập thành công!', 
      packageId: result.insertId 
    });
  });
};

// 2. Lấy danh sách toàn bộ gói tập
export const listPackages = (req, res) => {
  getAllPackages((err, packages) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi lấy danh sách gói tập: ' + err.message });
    res.status(200).json(packages);
  });
};

// 3. Xem chi tiết 1 gói tập kèm theo thông tin Hội viên đang sử dụng
export const getPackageDetail = (req, res) => {
  const packageId = req.params.id;

  getPackageById(packageId, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy gói tập này!' });

    // Cấu trúc lại dữ liệu: Gộp thông tin gói tập và đưa danh sách người dùng vào mảng "members"
    const packageInfo = {
      id: rows[0].package_id,
      name: rows[0].package_name,
      price: rows[0].price,
      description: rows[0].description,
      duration_days: rows[0].duration_days,
      is_active: rows[0].is_active,
      service_id: rows[0].service_id,
      members: [] // Mảng chứa thông tin những user đang dùng gói này
    };

    // Duyệt qua dữ liệu trả về để lấy thông tin các thành viên đã mua gói
    rows.forEach(row => {
      if (row.user_package_id) { // Chỉ add nếu gói này đã có người đăng ký mua
        packageInfo.members.push({
          user_package_id: row.user_package_id,
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.purchase_status,
          purchase_date: row.purchase_date
        });
      }
    });

    res.status(200).json(packageInfo);
  });
};

// 4. Cập nhật gói tập
export const updatePackage = (req, res) => {
  const packageId = req.params.id;
  const { name, price, description, duration_days, is_active, service_id } = req.body;

  if (!name || price === undefined || !duration_days || !service_id) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin để cập nhật!' });
  }

  const payload = { name, price, description, duration_days, is_active, service_id };

  updatePackageById(packageId, payload, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật gói tập: ' + err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy gói tập để cập nhật!' });

    res.status(200).json({ message: 'Cập nhật gói tập thành công!' });
  });
};

// 5. Xóa gói tập an toàn (Xóa cả dữ liệu liên đới ở bảng user_package)
export const deletePackage = (req, res) => {
  const packageId = req.params.id;

  if (!packageId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ID gói tập cần xóa!' });
  }

  deletePackageById(packageId, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi xóa gói tập: ' + err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy gói tập này hoặc gói đã bị xóa từ trước!' });
    }

    res.status(200).json({ 
      message: 'Xóa gói tập và toàn bộ lịch sử đăng ký của hội viên liên quan thành công!' 
    });
  });
};