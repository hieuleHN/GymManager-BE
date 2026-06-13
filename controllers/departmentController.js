import Department from "../models/departmentModel.js";

export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).populate(
      "locationId",
    );
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách bộ môn", error });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const newDept = new Department(req.body);
    const savedDept = await newDept.save();
    res.status(201).json(savedDept);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo bộ môn", error });
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      "locationId",
    );
    if (!department)
      return res.status(404).json({ message: "Không tìm thấy bộ môn!" });
    res.status(200).json(department);
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const updatedDept = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );
    if (!updatedDept)
      return res.status(404).json({ message: "Không tìm thấy bộ môn!" });
    res
      .status(200)
      .json({ message: "Cập nhật thành công!", department: updatedDept });
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const deletedDept = await Department.findByIdAndDelete(req.params.id);
    if (!deletedDept)
      return res.status(404).json({ message: "Không tìm thấy bộ môn!" });
    res.status(200).json({ message: "Xóa bộ môn thành công!" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};
