import * as LockerModel from '../models/lockerModel.js';

export const list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const { locationId, status, fromDate, toDate } = req.query;

    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ error: 'Ngày bắt đầu không được sau ngày kết thúc!' });
    }
    const now = new Date();
    if (fromDate && new Date(fromDate) > now) {
      return res.status(400).json({ error: 'Không được lọc ngày tương lai!' });
    }
    if (toDate && new Date(toDate) > now) {
      return res.status(400).json({ error: 'Không được lọc ngày tương lai!' });
    }

    const reporterId = req.user.isAdmin ? null : req.user.id;
    const result = await LockerModel.getAll(page, limit, locationId || null, reporterId, status || null, fromDate || null, toDate || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
  }
};

export const detail = async (req, res) => {
  try {
    const issue = await LockerModel.getById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Không tìm thấy vấn đề!' });
    if (!req.user.isAdmin && String(issue.reporterId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem báo cáo này!' });
    }
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { lockerNumber, issueType, description, locationId } = req.body;
    if (!lockerNumber?.trim()) return res.status(400).json({ error: 'Vui lòng nhập số tủ!' });
    if (!issueType) return res.status(400).json({ error: 'Vui lòng chọn loại vấn đề!' });
    if (!description?.trim()) return res.status(400).json({ error: 'Vui lòng nhập mô tả chi tiết!' });

    // Kiểm tra trùng: cùng số tủ + cùng loại vấn đề + đang chờ xử lý
    const existingIssue = await LockerModel.findPendingByLockerAndType(lockerNumber.trim(), issueType);
    if (existingIssue) {
      return res.status(400).json({ error: 'Tủ này đã có báo cáo "' + (issueType === 'broken' ? 'Hỏng hóc' : issueType === 'dirty' ? 'Bẩn' : issueType === 'lost-key' ? 'Mất chìa khóa' : 'Khác') + '" đang chờ xử lý!' });
    }

    const result = await LockerModel.create({
      lockerNumber: lockerNumber.trim(),
      issueType,
      description: description.trim(),
      reporterId: req.user.id,
      reporterName: req.user.fullName || req.user.username,
      locationId,
      image: req.file ? req.file.filename : null,
    });
    res.status(201).json({ message: 'Báo cáo vấn đề thành công!', id: result.id });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi thêm vấn đề!' });
  }
};

export const update = async (req, res) => {
  try {
    const issue = await LockerModel.getById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Không tìm thấy vấn đề!' });
    if (!req.user.isAdmin && String(issue.reporterId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa báo cáo này!' });
    }
    if (issue.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể sửa báo cáo đang chờ xử lý!' });
    }
    const { lockerNumber, issueType, description } = req.body;
    const data = {};
    if (lockerNumber !== undefined) { if (!lockerNumber.trim()) return res.status(400).json({ error: 'Số tủ không được để trống!' }); data.lockerNumber = lockerNumber.trim(); }
    if (issueType !== undefined) data.issueType = issueType;
    if (description !== undefined) { if (!description.trim()) return res.status(400).json({ error: 'Mô tả không được để trống!' }); data.description = description.trim(); }
    if (req.file) data.image = req.file.filename;
    const updated = await LockerModel.updateById(req.params.id, data);
    res.json({ message: 'Cập nhật vấn đề thành công!', issue: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
  }
};
export const remove = async (req, res) => {
  try {
    const issue = await LockerModel.getById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Không tìm thấy vấn đề!' });
    if (!req.user.isAdmin && String(issue.reporterId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa báo cáo này!' });
    }
    if (issue.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể xóa báo cáo đang chờ xử lý!' });
    }
    await LockerModel.deleteById(req.params.id);
    res.json({ message: 'Xóa vấn đề thành công!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const resolve = async (req, res) => {
  try {
    const issue = await LockerModel.markResolved(req.params.id);
    res.json({ message: 'Đã đánh dấu hoàn thành!', issue });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi cập nhật trạng thái!' });
  }
};

export const reject = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason?.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối!' });
    }
    const issue = await LockerModel.reject(req.params.id, rejectionReason.trim());
    res.json({ message: 'Đã từ chối báo cáo!', issue });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi từ chối báo cáo!' });
  }
};
