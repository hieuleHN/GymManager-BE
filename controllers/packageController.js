import { 
  createPackage, 
  getAllPackages, 
  getPackageById, 
  updatePackageById, 
  deletePackageById,
  getPackagesByDiscipline
} from '../models/packageModel.js';

export const addPackage = (req, res) => {
  const { name, price, description, duration_days, is_active, service_id, unitPrice, disciplineId, features, durations, contractA, contractB, contractTerms, locationId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tên gói tập!' });
  }

  const payload = { name, price: price ?? unitPrice, description, duration_days, is_active, service_id, unitPrice, disciplineId, features, durations, contractA, contractB, contractTerms, locationId };

  createPackage(payload, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi thêm gói tập: ' + err.message });
    res.status(201).json({ 
      message: 'Thêm gói tập thành công!', 
      packageId: result._id || result.insertId 
    });
  });
};

export const listPackages = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId, disciplineId } = req.query;
  getAllPackages(page, limit, locationId || null, disciplineId || null, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi lấy danh sách gói tập: ' + err.message });
    res.status(200).json(result);
  });
};

export const getPackagesByDisciplineId = (req, res) => {
  const { disciplineId } = req.params;
  if (!disciplineId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ID bộ môn!' });
  }
  getPackagesByDiscipline(disciplineId, (err, packages) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi lấy gói tập theo bộ môn: ' + err.message });
    res.status(200).json(packages);
  });
};

export const getPackageDetail = (req, res) => {
  const packageId = req.params.id;

  getPackageById(packageId, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!rows || (Array.isArray(rows) && rows.length === 0)) return res.status(404).json({ error: 'Không tìm thấy gói tập này!' });

    const pkg = Array.isArray(rows) ? rows[0] : rows;

    const packageInfo = {
      id: pkg._id || pkg.package_id,
      name: pkg.name || pkg.package_name,
      price: pkg.price,
      description: pkg.description,
      duration_days: pkg.duration_days,
      is_active: pkg.is_active,
      service_id: pkg.service_id,
      unitPrice: pkg.unitPrice,
      disciplineId: pkg.disciplineId,
      features: pkg.features,
      durations: pkg.durations,
      contractA: pkg.contractA,
      contractB: pkg.contractB,
      contractTerms: pkg.contractTerms,
      locationId: pkg.locationId,
      members: []
    };

    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (row.user_package_id) {
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
    }

    res.status(200).json(packageInfo);
  });
};

export const updatePackage = (req, res) => {
  const packageId = req.params.id;
  const { name, price, description, duration_days, is_active, service_id, unitPrice, disciplineId, features, durations, contractA, contractB, contractTerms, locationId } = req.body;

  const payload = { name, price: price ?? unitPrice, description, duration_days, is_active, service_id, unitPrice, disciplineId, features, durations, contractA, contractB, contractTerms, locationId, updatedAt: new Date() };

  updatePackageById(packageId, payload, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật gói tập: ' + err.message });
    if (!result) return res.status(404).json({ error: 'Không tìm thấy gói tập để cập nhật!' });

    res.status(200).json({ message: 'Cập nhật gói tập thành công!', data: result });
  });
};

export const deletePackage = (req, res) => {
  const packageId = req.params.id;

  if (!packageId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ID gói tập cần xóa!' });
  }

  deletePackageById(packageId, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi xóa gói tập: ' + err.message });
    if (result && result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy gói tập này hoặc gói đã bị xóa từ trước!' });
    }

    res.status(200).json({ 
      message: 'Xóa gói tập và toàn bộ lịch sử đăng ký của hội viên liên quan thành công!' 
    });
  });
};
