import {
  createReturn, getAllReturns, deleteReturnById
} from '../models/productReturnModel.js';

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId } = req.query;
  getAllReturns(page, limit, locationId || null, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách phiếu trả hàng: ' + err.message });
    res.json(result);
  });
};

export const create = (req, res) => {
  const { productName, reason, quantity, locationId } = req.body;
  if (!productName || !reason || !quantity || !locationId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: tên sản phẩm, lý do, số lượng, cơ sở!' });
  }
  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Số lượng phải là số dương!' });
  }
  createReturn({ productName, reason, quantity, locationId }, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi thêm phiếu trả hàng: ' + err.message });
    res.status(201).json({ message: 'Thêm phiếu trả hàng thành công!', returnId: result.returnId });
  });
};

export const remove = (req, res) => {
  deleteReturnById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa phiếu trả hàng thành công!' });
  });
};