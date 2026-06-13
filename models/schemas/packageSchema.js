import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    durationText: { type: String, required: true },
    features: [{ type: String }],
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    locationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default packageSchema;
