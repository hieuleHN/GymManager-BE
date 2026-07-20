import WalletTransaction from './schemas/walletTransactionSchema.js';

export const createWalletTransaction = async (data, callback) => {
  try {
    const tx = new WalletTransaction(data);
    const saved = await tx.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getWalletTransactionByTxnRef = async (txnRef, callback) => {
  try {
    const tx = await WalletTransaction.findOne({ vnpayTxnRef: txnRef });
    callback(null, tx);
  } catch (err) {
    callback(err);
  }
};

export const markTransactionCompleted = async (id, vnpayData, callback) => {
  try {
    const tx = await WalletTransaction.findByIdAndUpdate(id, {
      status: 'completed',
      vnpayTransactionNo: vnpayData.vnpayTransactionNo,
      vnpayBankCode: vnpayData.vnpayBankCode,
      vnpayBankTranNo: vnpayData.vnpayBankTranNo,
      vnpayCardType: vnpayData.vnpayCardType,
      vnpayPayDate: vnpayData.vnpayPayDate,
      updatedAt: new Date()
    }, { new: true });
    callback(null, tx);
  } catch (err) {
    callback(err);
  }
};

export const getTransactionsByCustomer = async (customerId, callback) => {
  try {
    const txs = await WalletTransaction.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(50);
    callback(null, txs);
  } catch (err) {
    callback(err);
  }
};
