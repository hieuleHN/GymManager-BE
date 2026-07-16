import VnpayGroup from './schemas/vnpayGroupSchema.js';

export const createVnpayGroup = async (data, callback) => {
  try {
    const group = new VnpayGroup(data);
    const saved = await group.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getVnpayGroupByTxnRef = async (txnRef, callback) => {
  try {
    const group = await VnpayGroup.findOne({ txnRef });
    callback(null, group);
  } catch (err) {
    callback(err);
  }
};

export const markVnpayGroupPaid = async (txnRef, callback) => {
  try {
    const group = await VnpayGroup.findOneAndUpdate(
      { txnRef },
      { paid: true, updatedAt: new Date() },
      { new: true }
    );
    callback(null, group);
  } catch (err) {
    callback(err);
  }
};
