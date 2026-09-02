import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ["equipment", "utilities", "tax", "other"],
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Số tiền phải lớn hơn 0'],
  },
  date: {
    type: Date,
    required: true,
  },
  note: {
    type: String,
    default: "",
    trim: true,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

expenseSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Expense", expenseSchema);
