import Package from "../models/packageModel.js";

// 1. Thêm gói tập mới
export const addPackage = async (req, res) => {
  try {
    const newPackage = new Package(req.body); // req.body đã chứa name, price, departmentId, v.v.
    const result = await newPackage.save();
    res
      .status(201)
      .json({ message: "Thêm gói tập thành công!", packageId: result._id });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
  }
};

// 2. Lấy danh sách toàn bộ gói tập
export const listPackages = async (req, res) => {
  try {
    const packages = await Package.find().populate("departmentId", "name");
    res.status(200).json(packages);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách: " + err.message });
  }
};

// 3. Xem chi tiết (đã tích hợp populate)
export const getPackageDetail = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id)
      .populate("departmentId")
      .populate("locationIds");

    if (!pkg) return res.status(404).json({ error: "Không tìm thấy gói tập!" });
    res.status(200).json(pkg);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
  }
};

// 4. Cập nhật gói tập
export const updatePackage = async (req, res) => {
  try {
    const result = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!result)
      return res.status(404).json({ error: "Không tìm thấy gói tập!" });
    res.status(200).json({ message: "Cập nhật thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
  }
};

// 5. Xóa gói tập
export const deletePackage = async (req, res) => {
  try {
    const result = await Package.findByIdAndDelete(req.params.id);
    if (!result)
      return res.status(404).json({ error: "Không tìm thấy gói tập!" });
    res.status(200).json({ message: "Xóa gói tập thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống: " + err.message });
  }
};
