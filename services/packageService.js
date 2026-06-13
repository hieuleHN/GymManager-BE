import Package from "../models/packageModel.js";
import UserPackage from "../models/schemas/userPackageSchema.js";

// 1. CREATE
export const createPackage = async (packageData) => {
  const pkg = new Package(packageData);
  return await pkg.save();
};

// 2. READ (Danh sách)
export const getAllPackages = async () => {
  return await Package.find().populate("departmentId", "name");
};

// 3. READ (Chi tiết)
export const getPackageById = async (id) => {
  // populate thêm locationIds để FE có thông tin đầy đủ
  return await Package.findById(id)
    .populate("departmentId")
    .populate("locationIds");
};

// 4. UPDATE
export const updatePackageById = async (id, packageData) => {
  return await Package.findByIdAndUpdate(id, packageData, { new: true });
};

// 5. DELETE
export const deletePackageById = async (id) => {
  await UserPackage.deleteMany({ package_id: id });
  return await Package.findByIdAndDelete(id);
};
