import * as ExpenseModel from "../models/expenseModel.js";

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId } = req.query;
  ExpenseModel.getAll(page, limit, locationId || null, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Lỗi lấy danh sách: " + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  ExpenseModel.getById(req.params.id, (err, expense) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!expense)
      return res.status(404).json({ error: "Không tìm thấy chi phí!" });
    res.json(expense);
  });
};

export const create = (req, res) => {
  const { category, description, amount, date, note, locationId } = req.body;
  if (!category)
    return res.status(400).json({ error: "Vui lòng chọn loại chi phí!" });
  if (!description?.trim())
    return res.status(400).json({ error: "Vui lòng nhập mô tả chi phí!" });
  if (amount === undefined || Number(amount) <= 0)
    return res.status(400).json({ error: "Số tiền phải lớn hơn 0!" });
  if (!date) return res.status(400).json({ error: "Vui lòng chọn ngày!" });
  ExpenseModel.create(
    {
      category,
      description: description.trim(),
      amount,
      date,
      note,
      locationId,
    },
    (err, result) => {
      if (err)
        return res
          .status(400)
          .json({ error: err.message || "Lỗi thêm chi phí!" });
      res
        .status(201)
        .json({ message: "Thêm chi phí thành công!", id: result.id });
    },
  );
};

export const update = (req, res) => {
  const { category, description, amount, date, note } = req.body;
  const data = {};
  if (category !== undefined) data.category = category;
  if (description !== undefined) {
    if (!description.trim())
      return res.status(400).json({ error: "Mô tả không được để trống!" });
    data.description = description.trim();
  }
  if (amount !== undefined) {
    if (Number(amount) <= 0)
      return res.status(400).json({ error: "Số tiền phải lớn hơn 0!" });
    data.amount = amount;
  }
  if (date !== undefined) data.date = date;
  if (note !== undefined) data.note = note;
  ExpenseModel.updateById(req.params.id, data, (err, expense) => {
    if (err)
      return res.status(400).json({ error: err.message || "Lỗi cập nhật!" });
    res.json({ message: "Cập nhật chi phí thành công!", expense });
  });
};

export const remove = (req, res) => {
  ExpenseModel.deleteById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: "Xóa chi phí thành công!" });
  });
};
