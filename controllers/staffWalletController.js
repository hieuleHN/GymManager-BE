import Staff from "../models/schemas/staffSchema.js";
import WalletTransaction from "../models/schemas/walletTransactionSchema.js";

export const getBalance = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user.id).select("balance");
    if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên!" });
    res.json({ balance: staff.balance || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const txs = await WalletTransaction.find({ staffId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(txs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
