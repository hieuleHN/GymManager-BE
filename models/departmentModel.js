import mongoose from "mongoose";
import departmentSchema from "./schemas/departmentSchema.js";

const Department = mongoose.model("Department", departmentSchema);
export default Department;
