import Equipment from '../models/schemas/equipmentSchema.js';

export const getAllEquipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const { locationId } = req.query;
    const filter = locationId ? { location_id: locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Equipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Equipment.countDocuments(filter)
    ]);
    res.status(200).json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const getEquipmentsByLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    if (!locationId) return res.status(400).json({ message: 'Thiếu locationId!' });
    const equipments = await Equipment.find({ location_id: locationId });
    res.status(200).json(equipments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findById(id);
    if (!equipment) return res.status(404).json({ message: 'Không tìm thấy thiết bị này!' });
    res.status(200).json(equipment);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const createEquipment = async (req, res) => {
  try {
    const newEquipment = new Equipment(req.body);
    const savedEquipment = await newEquipment.save();
    res.status(201).json({ message: 'Thêm thiết bị thành công!', data: savedEquipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedEquipment = await Equipment.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedEquipment) return res.status(404).json({ message: 'Không tìm thấy thiết bị để cập nhật!' });
    res.status(200).json({ message: 'Cập nhật thiết bị thành công!', data: updatedEquipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEquipment = await Equipment.findByIdAndDelete(id);
    if (!deletedEquipment) return res.status(404).json({ message: 'Không tìm thấy thiết bị để xóa!' });
    res.status(200).json({ message: 'Xóa thiết bị thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const reportEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusType, reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do!' });
    const equipment = await Equipment.findByIdAndUpdate(id, {
      $push: { reports: { statusType: statusType || 'hoạt động', reason, reportedAt: new Date(), status: 'pending' } }
    }, { new: true });
    if (!equipment) return res.status(404).json({ message: 'Không tìm thấy thiết bị!' });
    res.status(200).json({ message: 'Đã gửi báo cáo!', data: equipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

export const resolveReport = async (req, res) => {
  try {
    const { id, reportId } = req.params;
    const equipment = await Equipment.findOneAndUpdate(
      { _id: id, 'reports._id': reportId },
      { $set: { 'reports.$.status': 'resolved' } },
      { new: true }
    );
    if (!equipment) return res.status(404).json({ message: 'Không tìm thấy thiết bị hoặc báo cáo!' });
    res.status(200).json({ message: 'Đã hoàn thành báo cáo!', data: equipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};
