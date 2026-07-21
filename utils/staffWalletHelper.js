import Staff from "../models/schemas/staffSchema.js";
import Job from "../models/schemas/jobSchema.js";
import WalletTransaction from "../models/schemas/walletTransactionSchema.js";

export const creditStaffWallets = async (amount, description) => {
  try {
    const jobs = await Job.find({ permissions: "wallet" });
    const jobIds = jobs.map(j => j._id);
    const staffList = await Staff.find({ job: { $in: jobIds } });

    for (const staff of staffList) {
      const before = staff.balance || 0;
      await Staff.findByIdAndUpdate(staff._id, { $inc: { balance: amount } });
      await new WalletTransaction({
        staffId: staff._id,
        type: "payment",
        amount,
        balanceBefore: before,
        balanceAfter: before + amount,
        status: "completed",
        description,
      }).save();
    }
  } catch (err) {
    console.error("Lỗi credit staff wallet:", err.message);
  }
};

export const debitStaffWallets = async (amount, description) => {
  try {
    const jobs = await Job.find({ permissions: "wallet" });
    const jobIds = jobs.map(j => j._id);
    const staffList = await Staff.find({ job: { $in: jobIds } });

    for (const staff of staffList) {
      const before = staff.balance || 0;
      await Staff.findByIdAndUpdate(staff._id, { $inc: { balance: -amount } });
      await new WalletTransaction({
        staffId: staff._id,
        type: "refund",
        amount: -amount,
        balanceBefore: before,
        balanceAfter: before - amount,
        status: "completed",
        description,
      }).save();
    }
  } catch (err) {
    console.error("Lỗi debit staff wallet:", err.message);
  }
};
