import mongoose from "mongoose";
import packageSchema from "./schemas/packageSchema.js";

const Package = mongoose.model("Package", packageSchema);
export default Package;
