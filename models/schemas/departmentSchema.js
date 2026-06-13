import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    goals: [{ type: String }],
    imagesSlider: [{ type: String }],
    amenities: [{ type: String }],
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default departmentSchema;
