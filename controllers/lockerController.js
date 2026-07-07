import * as LockerModel from '../models/lockerModel.js';

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId, status } = req.query;
  // Quan trọng: không tin query string của client cho việc lọc "của tôi".
  // Nếu người gọi không phải admin, luôn ép filter theo chính req.user.id
  // (lấy từ token đã xác thực), để HLV không thể truyền reporterId của người khác để xem trộm.
  const reporterId = req.user.isAdmin ? null : req.user.id;
  LockerModel.getAll(page, limit, locationId || null, reporterId, status || null, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  LockerModel.getById(req.params.id, (err, issue) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!issue) return res.status(404).json({ error: 'Không tìm thấy vấn đề!' });
    if (!req.user.isAdmin && String(issue.reporterId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem báo cáo này!' });
    }
    res.json(issue);
  });
};

export const create = (req, res) => {
  const { lockerNumber, issueType, description, locationId } = req.body;
  if (!lockerNumber?.trim()) return res.status(400).json({ error: 'Vui lòng nhập số tủ!' });
  if (!issueType) return res.status(400).json({ error: 'Vui lòng chọn loại vấn đề!' });
  if (!description?.trim()) return res.status(400).json({ error: 'Vui lòng nhập mô tả chi tiết!' });
  // reporterId/reporterName lấy từ token đã xác thực (req.user), KHÔNG nhận từ client nữa
  // -> không ai giả mạo được tên người báo cáo.
  LockerModel.create({
    lockerNumber: lockerNumber.trim(),
    issueType,
    description: description.trim(),
    reporterId: req.user.id,
    reporterName: req.user.fullName || req.user.username,
    locationId,
  }, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm vấn đề!' });
    res.status(201).json({ message: 'Báo cáo vấn đề thành công!', id: result.id });
  });
};

export const update = (req, res) => {
  const { lockerNumber, issueType, description } = req.body;
  const data = {};
  if (lockerNumber !== undefined) { if (!lockerNumber.trim()) return res.status(400).json({ error: 'Số tủ không được để trống!' }); data.lockerNumber = lockerNumber.trim(); }
  if (issueType !== undefined) data.issueType = issueType;
  if (description !== undefined) { if (!description.trim()) return res.status(400).json({ error: 'Mô tả không được để trống!' }); data.description = description.trim(); }
  LockerModel.updateById(req.params.id, data, (err, issue) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật vấn đề thành công!', issue });
  });
};

export const resolve = (req, res) => {
  LockerModel.markResolved(req.params.id, (err, issue) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật trạng thái!' });
    res.json({ message: 'Đã đánh dấu hoàn thành!', issue });
  });
};

export const reject = (req, res) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason?.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối!' });
  }
  LockerModel.reject(req.params.id, rejectionReason.trim(), (err, issue) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi từ chối báo cáo!' });
    res.json({ message: 'Đã từ chối báo cáo!', issue });
  });
};

export const remove = (req, res) => {
  LockerModel.deleteById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa vấn đề thành công!' });
  });
};
