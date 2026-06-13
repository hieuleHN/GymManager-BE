import Equipment from '../models/schemas/equipmentSchema.js';

// 1. Lấy tất cả thiết bị, hỗ trợ lọc theo locationId query param
export const getAllEquipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const { locationId } = req.query;
    const filter = locationId ? { location_id: locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Equipment.find(filter).skip(skip).limit(limit),
      Equipment.countDocuments(filter)
    ]);
    res.status(200).json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 2. Lấy danh sách thiết bị THEO CƠ SỞ (Khớp với params :locationId)
export const getEquipmentsByLocation = async (req, res) => {
  try {
    const { locationId } = req.params; // Lấy locationId từ URL params
    
    if (!locationId) {
      return res.status(400).json({ message: 'Thiếu locationId!' });
    }

    // Tìm các thiết bị có trường location_id trùng với ID cơ sở truyền vào
    const equipments = await Equipment.find({ location_id: locationId });
    res.status(200).json(equipments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 3. Lấy chi tiết MỘT thiết bị theo ID
export const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findById(id);

    if (!equipment) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị này!' });
    }

    res.status(200).json(equipment);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 4. THÊM mới thiết bị (Có trường supplier và location_id)
export const createEquipment = async (req, res) => {
  try {
    const newEquipment = new Equipment(req.body);
    const savedEquipment = await newEquipment.save();
    res.status(201).json({ message: 'Thêm thiết bị thành công!', data: savedEquipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 5. CẬP NHẬT thông tin thiết bị
export const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedEquipment = await Equipment.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedEquipment) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị để cập nhật!' });
    }

    res.status(200).json({ message: 'Cập nhật thiết bị thành công!', data: updatedEquipment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 6. XÓA thiết bị
export const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEquipment = await Equipment.findByIdAndDelete(id);

    if (!deletedEquipment) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị để xóa!' });
    }

    res.status(200).json({ message: 'Xóa thiết bị thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};