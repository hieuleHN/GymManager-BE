import ServiceRequest from './schemas/serviceRequestSchema.js';

export const createRequest = async (data, callback) => {
  try {
    const request = new ServiceRequest({
      customer_id: data.customer_id,
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      service_type: data.service_type,
      description: data.description || '',
      data: data.data || {},
      location_id: data.location_id || null,
      status: data.status || 'pending',
      amount: data.amount || 0,
      payment_status: data.payment_status || 'unpaid',
      payment_method: data.payment_method || ''
    });
    const saved = await request.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getMyRequests = async (customerId, callback) => {
  try {
    const requests = await ServiceRequest.find({ customer_id: customerId })
      .populate('location_id', 'title address')
      .sort({ createdAt: -1 });
    callback(null, requests);
  } catch (err) {
    callback(err);
  }
};

export const getRequests = async (filters = {}, page = 1, limit = 20, callback) => {
  try {
    const filter = {};
    if (filters.status) filter.status = filters.status;
    if (filters.service_type) filter.service_type = filters.service_type;
    if (filters.location_id) filter.location_id = filters.location_id;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ServiceRequest.find(filter)
        .populate('customer_id', 'fullName phone')
        .populate('location_id', 'title address')
        .populate('processed_by', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      ServiceRequest.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit });
  } catch (err) {
    callback(err);
  }
};

export const getRequestById = async (id, callback) => {
  try {
    const request = await ServiceRequest.findById(id);
    if (!request) return callback(null, null);
    callback(null, request);
  } catch (err) {
    callback(err);
  }
};

export const getRequestByTxnRef = async (txnRef, callback) => {
  try {
    const request = await ServiceRequest.findOne({ vnpay_txn_ref: txnRef });
    if (!request) return callback(null, null);
    callback(null, request);
  } catch (err) {
    callback(err);
  }
};

export const updateRequestStatus = async (id, update, callback) => {
  try {
    const updated = await ServiceRequest.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return callback(new Error('NotFound'));
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};
