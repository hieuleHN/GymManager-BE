import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import {
  register, list, detail, update, remove, approve, reject, pendingList, myInfo, submitInfo, publicProfile, uploadAvatar,
  search, changePassword
} from '../controllers/customerController.js';
import { login } from '../controllers/customerAuthController.js';
import Customer from '../models/schemas/customerSchema.js';
import UserPackage from '../models/schemas/userPackageSchema.js';
import CheckIn from '../models/schemas/checkInSchema.js';
import ServiceRequest from '../models/schemas/serviceRequestSchema.js';
import WalletTransaction from '../models/schemas/walletTransactionSchema.js';
import Location from '../models/schemas/locationSchema.js';
import mongoose from 'mongoose';

const router = express.Router();
const uploadCustomer = uploadDynamic('customers');

const handleUpload = (req, res, next) => {
  uploadCustomer.fields([
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const locationId = req.query.locationId && req.query.locationId !== 'all' ? req.query.locationId : null;
    const locFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};
    const custLocFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Sắp hết hạn 7 ngày
    const expiringSoon = await UserPackage.find({
      ...locFilter,
      payment_status: 'đã thanh toán',
      status: { $in: ['đang hoạt động', 'còn 10 ngày'] },
      end_date: { $gte: now, $lte: in7Days }
    }).populate('customer_id', 'fullName account phone email gender address locationId').populate({ path: 'package_id', select: 'name disciplineId unitPrice', populate: { path: 'disciplineId', select: 'name' } }).limit(50).lean();

    // Đã hết hạn (quá hạn nhưng chưa hủy)
    const expired = await UserPackage.find({
      ...locFilter,
      payment_status: 'đã thanh toán',
      end_date: { $lt: now },
      status: { $ne: 'đã hủy' }
    }).populate('customer_id', 'fullName account phone email gender address locationId').populate({ path: 'package_id', select: 'name disciplineId unitPrice', populate: { path: 'disciplineId', select: 'name' } }).sort({ end_date: -1 }).limit(50).lean();

    // Chờ duyệt quá 48h
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const pendingOverdue = await Customer.find({
      ...custLocFilter,
      status: 'pending_approval',
      createdAt: { $lte: twoDaysAgo }
    }).select('fullName account phone email createdAt status').sort({ createdAt: 1 }).limit(50).lean();

    // Chờ duyệt tất cả (để badge)
    const pendingCount = await Customer.countDocuments({ ...custLocFilter, status: 'pending_approval' });

    res.json({
      expiring_soon: expiringSoon.map(up => ({
        _id: up._id,
        packageName: up.package_id?.name || 'Gói tập',
        packageId: up.package_id?._id || up.package_id || null,
        disciplineName: up.package_id?.disciplineId?.name || '',
        disciplineId: up.package_id?.disciplineId?._id || up.package_id?.disciplineId || null,
        customer: up.customer_id,
        end_date: up.end_date,
        daysLeft: Math.ceil((new Date(up.end_date) - now) / (1000*60*60*24)),
        total_price: up.total_price
      })),
      expired: expired.map(up => ({
        _id: up._id,
        packageName: up.package_id?.name || 'Gói tập',
        packageId: up.package_id?._id || up.package_id || null,
        disciplineName: up.package_id?.disciplineId?.name || '',
        disciplineId: up.package_id?.disciplineId?._id || up.package_id?.disciplineId || null,
        customer: up.customer_id,
        end_date: up.end_date,
        daysOverdue: Math.ceil((now - new Date(up.end_date)) / (1000*60*60*24)),
        total_price: up.total_price
      })),
      pending_overdue: pendingOverdue,
      pendingCount,
      summary: {
        expiringSoonCount: expiringSoon.length,
        expiredCount: expired.length,
        pendingOverdueCount: pendingOverdue.length,
        pendingCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/kpi', authenticateToken, async (req, res) => {
  try {
    const locationId = req.query.locationId && req.query.locationId !== 'all' ? req.query.locationId : null;
    const custFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};
    const pkgFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const totalMembers = await Customer.countDocuments(custFilter);
    const newThisMonth = await Customer.countDocuments({ ...custFilter, createdAt: { $gte: startOfMonth } });
    const newPrevMonth = await Customer.countDocuments({ ...custFilter, createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } });

    const activePkgs = await UserPackage.find({ ...pkgFilter, payment_status: 'đã thanh toán', end_date: { $gte: now } }).lean();
    const activeMembers = new Set(activePkgs.map(p => String(p.customer_id))).size;

    const expiredThisMonth = await UserPackage.find({ ...pkgFilter, payment_status: 'đã thanh toán', end_date: { $gte: startOfMonth, $lte: now } }).lean();
    const renewedCount = await Promise.all(expiredThisMonth.map(async up => {
      const hasRenew = await UserPackage.findOne({ customer_id: up.customer_id, payment_status: 'đã thanh toán', start_date: { $gt: up.end_date } });
      return hasRenew ? 1 : 0;
    }));
    const totalRenewed = renewedCount.reduce((a,b)=>a+b,0);
    const retentionRate = expiredThisMonth.length ? Math.round((totalRenewed/expiredThisMonth.length)*100) : 100;

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const realCash = await UserPackage.aggregate([{ $match: { ...pkgFilter, payment_status: 'đã thanh toán', payment_date: { $gte: startMonth, $lte: now } } }, { $group: { _id: null, total: { $sum: '$total_price' } } }]);
    const cashThisMonth = realCash[0]?.total || 0;
    const arpu = activeMembers ? Math.round(cashThisMonth / activeMembers) : 0;

    const pct = (cur, prev) => prev===0 ? (cur>0?100:0) : Number((((cur-prev)/prev)*100).toFixed(1));

    res.json({
      totalMembers, activeMembers, newThisMonth, retentionRate,
      arpu, cashThisMonth,
      change: {
        newMembers: pct(newThisMonth, newPrevMonth),
        retention: 0,
        arpu: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/detail360', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id).lean();
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });

    const oid = (()=>{ try{ return new mongoose.Types.ObjectId(id); }catch{ return null; } })();
    const orCustomer = oid ? [{ customer_id: oid }, { customerId: oid }, { customer_id: id }, { customerId: id }] : [{ customer_id: id }, { customerId: id }];
    const packages = await UserPackage.find({ $or: orCustomer })
      .populate('package_id', 'name unitPrice duration_months')
      .populate('locationId', 'title address')
      .sort({ createdAt: -1 }).lean();

    const checkins = await CheckIn.find({ $or: [{ customerId: id }, { customerId: oid }, { customerId: String(id) }] }).sort({ checkInTime: -1 }).limit(20).lean();

    // LTV tính tất cả gói (khách trả tiền mặt là xong, không có "chờ thanh toán")
    const ltvAgg = await UserPackage.aggregate([
      { $match: { $or: orCustomer } },
      { $match: { status: { $ne: 'đã hủy' } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total_price', '$totalPrice'] } }, count: { $sum: 1 } } }
    ]);
    let ltv = ltvAgg[0]?.total || 0;
    let packageCount = ltvAgg[0]?.count || 0;

    const activePkg = packages.find(p => new Date(p.end_date) >= new Date() && p.status !== 'đã hủy');

    // Lịch sử liên quan đến tiền: ServiceRequest + WalletTransaction
    const serviceRequests = await ServiceRequest.find({ customer_id: id }).sort({ createdAt: -1 }).lean();
    let walletTxs = [];
    try { walletTxs = await WalletTransaction.find({ customerId: id }).sort({ createdAt: -1 }).limit(50).lean(); } catch {}

    // Tính lại LTV mở rộng gồm cả phí dịch vụ đã thanh toán (nếu có)
    const servicePaidTotal = serviceRequests
      .filter((r) => r.payment_status === 'paid' || r.status === 'success' || r.status === 'accepted')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const now = new Date();
    const enrich = packages.map(p => {
      let diff;
      let displayEnd = p.end_date;
      if (p.status === 'đang tạm ngưng' && p.frozenAt) {
        if (p.frozenUntil) {
          // Đã có kỳ hạn: hiển thị hạn đã cộng bù (nếu đã cộng) hoặc sẽ cộng
          const isExtended = new Date(p.end_date) > new Date(p.frozenUntil);
          if (isExtended) {
            diff = Math.ceil((new Date(p.end_date) - new Date(p.frozenUntil)) / (1000*60*60*24));
            displayEnd = p.end_date;
          } else {
            diff = Math.ceil((new Date(p.end_date) - new Date(p.frozenAt)) / (1000*60*60*24));
            // Hiển thị hạn dự kiến sau khi cộng bù
            displayEnd = new Date(new Date(p.end_date).getTime() + (new Date(p.frozenUntil) - new Date(p.frozenAt)));
          }
        } else {
          // Khóa vô thời hạn: còn lại = hạn gốc - lúc khóa
          diff = Math.ceil((new Date(p.end_date) - new Date(p.frozenAt)) / (1000*60*60*24));
          displayEnd = p.end_date;
        }
        diff = Math.max(0, diff);
      } else {
        const end = new Date(p.end_date);
        diff = Math.ceil((end - now) / (1000*60*60*24));
      }
      return {
        _id: p._id, packageName: p.package_id?.name || 'Gói tập',
        packageId: p.package_id?._id || p.package_id || null,
        start_date: p.start_date, end_date: displayEnd,
        total_price: p.total_price, payment_status: p.payment_status, status: p.status,
        payment_method: p.payment_method || '',
        payment_date: p.payment_date || p.createdAt || null,
        createdAt: p.createdAt,
        duration_months: p.duration_months || 0,
        unit_price_applied: p.unit_price_applied || null,
        price_snapshot: p.price_snapshot || null,
        vnpay_txn_ref: p.vnpay_txn_ref || null,
        location: p.locationId?.title || '',
        daysLeft: diff,
        isFrozen: p.status === 'đang tạm ngưng',
        frozenAt: p.frozenAt, frozenUntil: p.frozenUntil
      };
    });

    // Build unified payment history: gói tập + thuê tủ + các dịch vụ có phí
    const packagePayments = enrich.map((p) => ({
      _id: p._id,
      type: 'package',
      title: p.packageName,
      amount: Number(p.total_price) || 0,
      durationLabel: p.duration_months ? `${p.duration_months} tháng` : '',
      date: p.payment_date || p.createdAt,
      payment_status: p.payment_status,
      payment_method: p.payment_method,
      status: p.status,
      location: p.location,
      start_date: p.start_date,
      end_date: p.end_date,
      raw: p
    }));

    const lockerPayments = serviceRequests.map((r) => {
      const isLocker = r.service_type === 'locker';
      const amt = Number(r.amount) || 0;
      const days = r.data?.durationDays || r.data?.duration || null;
      // Chỉ đưa vào lịch sử thanh toán nếu liên quan đến tiền (có amount >0) hoặc là thuê tủ / hoàn phí / đổi gói có phí
      const moneyRelated = isLocker || amt > 0 || ['cancel-refund','transfer','change-club','freeze'].includes(r.service_type);
      // vẫn giữ tất cả locker kể cả amount=0 để hiển thị thuê tủ miễn phí
      if (!moneyRelated && amt === 0) return null;
      return {
        _id: r._id,
        type: r.service_type === 'locker' ? 'locker' : 'service',
        title: r.service_type === 'locker'
          ? `Thuê tủ ${r.data?.lockerNumber ? `#${r.data.lockerNumber}` : ''}${days ? ` • ${days} ngày` : ''}`.trim()
          : r.service_type === 'cancel-refund' ? `Hủy/hoàn phí${r.data?.packageName ? `: ${r.data.packageName}` : ''}` : `${r.service_type}${r.description ? `: ${r.description.slice(0,60)}` : ''}`,
        amount: amt,
        durationLabel: days ? `${days} ngày` : '',
        date: r.paid_at || r.createdAt,
        payment_status: r.payment_status,
        payment_method: r.payment_method || '',
        status: r.status,
        description: r.description,
        data: r.data,
        raw: r
      };
    }).filter(Boolean);

    const walletPayments = walletTxs
      .filter((w) => w.type === 'payment' || w.type === 'refund' || w.amount !== 0)
      .map((w) => ({
        _id: w._id,
        type: 'wallet',
        title: w.description || (w.type === 'topup' ? 'Nạp ví' : w.type === 'payment' ? 'Thanh toán ví' : 'Hoàn ví'),
        amount: Math.abs(Number(w.amount) || 0),
        durationLabel: '',
        date: w.createdAt,
        payment_status: w.status === 'completed' ? 'paid' : w.status,
        payment_method: 'wallet',
        status: w.status,
        raw: w
      }));

    const allPayments = [...packagePayments, ...lockerPayments, ...walletPayments]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    res.json({
      customer: { _id: customer._id, fullName: customer.fullName, account: customer.account, phone: customer.phone, email: customer.email, status: customer.status, lockedAt: customer.lockedAt },
      packages: enrich,
      checkins: checkins.map(c => ({ _id: c._id, checkInTime: c.checkInTime, checkOutTime: c.checkOutTime, status: c.status, method: c.method })),
      ltv, packageCount,
      servicePaidTotal,
      ltvWithService: ltv + servicePaidTotal,
      activePackage: activePkg ? { packageName: activePkg.package_id?.name, end_date: activePkg.end_date } : null,
      totalCheckins: checkins.length,
      serviceRequests: serviceRequests.map((r) => ({
        _id: r._id, service_type: r.service_type, description: r.description,
        amount: r.amount, payment_status: r.payment_status, payment_method: r.payment_method,
        status: r.status, data: r.data, createdAt: r.createdAt, paid_at: r.paid_at
      })),
      walletTransactions: walletTxs,
      payments: allPayments,
      paymentHistory: allPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Đóng băng 1 gói
router.post('/:id/packages/:pkgId/freeze', authenticateToken, async (req, res) => {
  try {
    const { id, pkgId } = req.params;
    const months = parseInt(req.body.months);
    if (!months || months < 1 || months > 10) return res.status(400).json({ error: 'Thời gian đóng băng 1-10 tháng' });
    const pkg = await UserPackage.findOne({ _id: pkgId, customer_id: id });
    if (!pkg) return res.status(404).json({ error: 'Không tìm thấy gói' });
    if (pkg.status === 'đang tạm ngưng') return res.status(400).json({ error: 'Gói đang đóng băng rồi' });
    const now = new Date();
    const frozenUntil = new Date(now); frozenUntil.setMonth(frozenUntil.getMonth() + months);
    pkg.frozenAt = now; pkg.frozenUntil = frozenUntil; pkg.status = 'đang tạm ngưng';
    await pkg.save();
    const cust = await Customer.findById(id).select('fullName phone locationId');
    await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'freeze', description: `Admin đóng băng 1 gói ${months} tháng (tạm ngưng từ ${now.toLocaleDateString('vi-VN')} đến ${frozenUntil.toLocaleDateString('vi-VN')})`, data: { packageId: pkgId, duration: months }, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: `Đã đóng băng ${months} tháng (thời gian tạm ngưng, hạn sẽ cộng bù khi kích hoạt)`, data: pkg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kích hoạt lại 1 gói
router.post('/:id/packages/:pkgId/unfreeze', authenticateToken, async (req, res) => {
  try {
    const { id, pkgId } = req.params;
    const pkg = await UserPackage.findOne({ _id: pkgId, customer_id: id });
    if (!pkg) return res.status(404).json({ error: 'Không tìm thấy gói' });
    if (pkg.status !== 'đang tạm ngưng') return res.status(400).json({ error: 'Gói không ở trạng thái đóng băng' });
    // Cộng bù thời gian đã đóng băng (thực tế đã trôi qua) vào hạn
    if (pkg.frozenAt) {
      const now = new Date();
      const elapsed = now - new Date(pkg.frozenAt);
      const requested = pkg.frozenUntil ? new Date(pkg.frozenUntil) - new Date(pkg.frozenAt) : elapsed;
      const diffMs = Math.min(elapsed, requested);
      pkg.end_date = new Date(new Date(pkg.end_date).getTime() + diffMs);
    }
    const newEnd = pkg.end_date;
    pkg.status = 'đang hoạt động'; pkg.frozenAt = null; pkg.frozenUntil = null;
    await pkg.save();
    const cust = await Customer.findById(id).select('fullName phone locationId');
    await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'activate', description: `Admin kích hoạt lại 1 gói - hạn mới ${new Date(newEnd).toLocaleDateString('vi-VN')}`, data: { packageId: pkgId }, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: `Đã kích hoạt lại gói, hạn mới ${new Date(newEnd).toLocaleDateString('vi-VN')}`, data: pkg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Đóng băng toàn bộ gói đang hoạt động
router.post('/:id/freeze-all', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const months = parseInt(req.body.months);
    if (!months || months < 1 || months > 10) return res.status(400).json({ error: 'Thời gian đóng băng 1-10 tháng' });
    const now = new Date();
    const pkgs = await UserPackage.find({ customer_id: id, status: { $in: ['đang hoạt động','còn 10 ngày'] }, payment_status: 'đã thanh toán' });
    if (!pkgs.length) return res.status(400).json({ error: 'Không có gói đang hoạt động để đóng băng' });
    for (const pkg of pkgs) {
      const frozenUntil = new Date(now); frozenUntil.setMonth(frozenUntil.getMonth() + months);
      const newEnd = new Date(pkg.end_date); newEnd.setMonth(newEnd.getMonth() + months);
      pkg.frozenAt = now; pkg.frozenUntil = frozenUntil; pkg.status = 'đang tạm ngưng'; pkg.end_date = newEnd;
      await pkg.save();
    }
    const cust = await Customer.findById(id).select('fullName phone locationId');
    await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'freeze', description: `Admin đóng băng toàn bộ ${pkgs.length} gói ${months} tháng`, data: { duration: months, count: pkgs.length }, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: `Đã đóng băng ${pkgs.length} gói ${months} tháng` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kích hoạt toàn bộ
router.post('/:id/unfreeze-all', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pkgs = await UserPackage.find({ customer_id: id, status: 'đang tạm ngưng' });
    for (const pkg of pkgs) {
      if (pkg.frozenAt) {
        const elapsed = new Date() - new Date(pkg.frozenAt);
        const requested = pkg.frozenUntil ? new Date(pkg.frozenUntil) - new Date(pkg.frozenAt) : elapsed;
        const diffMs = Math.min(elapsed, requested);
        pkg.end_date = new Date(new Date(pkg.end_date).getTime() + diffMs);
      }
      pkg.status = 'đang hoạt động'; pkg.frozenAt = null; pkg.frozenUntil = null; await pkg.save();
    }
    const cust = await Customer.findById(id).select('fullName phone locationId');
    await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'activate', description: `Admin kích hoạt toàn bộ ${pkgs.length} gói`, data: { count: pkgs.length }, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: `Đã kích hoạt ${pkgs.length} gói` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Khóa / Mở khóa tài khoản
router.post('/:id/lock', authenticateToken, async (req, res) => {
  try {
    const cust = await Customer.findById(req.params.id);
    if (!cust) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    cust.status = 'locked'; cust.lockedAt = new Date(); await cust.save();
    // Đóng băng tất cả gói đang hoạt động khi khóa (giữ nguyên hạn, sẽ cộng bù khi mở)
    const now = new Date();
    const pkgs = await UserPackage.find({ customer_id: cust._id, status: { $in: ['đang hoạt động','còn 10 ngày'] } });
    for (const pkg of pkgs) { pkg.status = 'đang tạm ngưng'; pkg.frozenAt = now; await pkg.save(); }
    await ServiceRequest.create({ customer_id: cust._id, customer_name: cust.fullName||'', customer_phone: cust.phone||'', service_type: 'freeze', description: `Admin khóa tài khoản - đóng băng ${pkgs.length} gói`, data: { action: 'lock', count: pkgs.length }, location_id: cust.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: 'Đã khóa tài khoản, mọi hoạt động tạm dừng' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/unlock', authenticateToken, async (req, res) => {
  try {
    const cust = await Customer.findById(req.params.id);
    if (!cust) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    const lockedAt = cust.lockedAt ? new Date(cust.lockedAt) : null;
    cust.status = 'approved'; cust.lockedAt = null; await cust.save();
    // Cộng bù thời gian khóa vào hạn gói
    if (lockedAt) {
      const diffMonths = Math.max(0, Math.ceil((new Date() - lockedAt) / (1000*60*60*24*30)));
      const monthsToAdd = diffMonths || 0;
      const pkgs = await UserPackage.find({ customer_id: cust._id, status: 'đang tạm ngưng' });
      for (const pkg of pkgs) {
        if (pkg.frozenAt) {
          const newEnd = new Date(pkg.end_date); newEnd.setMonth(newEnd.getMonth() + monthsToAdd);
          pkg.end_date = newEnd;
        }
        pkg.status = 'đang hoạt động'; pkg.frozenAt = null; pkg.frozenUntil = null; await pkg.save();
      }
    } else {
      const pkgs = await UserPackage.find({ customer_id: cust._id, status: 'đang tạm ngưng' });
      for (const pkg of pkgs) { pkg.status = 'đang hoạt động'; pkg.frozenAt = null; pkg.frozenUntil = null; await pkg.save(); }
    }
    await ServiceRequest.create({ customer_id: cust._id, customer_name: cust.fullName||'', customer_phone: cust.phone||'', service_type: 'activate', description: `Admin mở khóa tài khoản`, data: {}, location_id: cust.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
    res.json({ message: 'Đã mở khóa tài khoản và kích hoạt lại gói' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk thao tác hàng loạt
router.post('/bulk/lock', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách ID' });
    let count=0;
    for (const id of ids) {
      const cust = await Customer.findById(id);
      if (!cust || cust.status==='locked') continue;
      cust.status='locked'; cust.lockedAt=new Date(); await cust.save();
      const pkgs = await UserPackage.find({ customer_id: cust._id, status: { $in: ['đang hoạt động','còn 10 ngày'] } });
      for (const pkg of pkgs) { pkg.status='đang tạm ngưng'; pkg.frozenAt=new Date(); await pkg.save(); }
      await ServiceRequest.create({ customer_id: cust._id, customer_name: cust.fullName||'', customer_phone: cust.phone||'', service_type: 'freeze', description: `Admin khóa tài khoản (bulk)`, data: {}, location_id: cust.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
      count++;
    }
    res.json({ message: `Đã khóa ${count} tài khoản` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/unlock', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách ID' });
    let count=0;
    for (const id of ids) {
      const cust = await Customer.findById(id);
      if (!cust || cust.status!=='locked') continue;
      const lockedAt = cust.lockedAt ? new Date(cust.lockedAt) : null;
      cust.status='approved'; cust.lockedAt=null; await cust.save();
      const monthsToAdd = lockedAt ? Math.max(0, Math.ceil((new Date()-lockedAt)/(1000*60*60*24*30))) : 0;
      const pkgs = await UserPackage.find({ customer_id: cust._id, status: 'đang tạm ngưng' });
      for (const pkg of pkgs) {
        if (monthsToAdd) { const newEnd=new Date(pkg.end_date); newEnd.setMonth(newEnd.getMonth()+monthsToAdd); pkg.end_date=newEnd; }
        pkg.status='đang hoạt động'; pkg.frozenAt=null; pkg.frozenUntil=null; await pkg.save();
      }
      await ServiceRequest.create({ customer_id: cust._id, customer_name: cust.fullName||'', customer_phone: cust.phone||'', service_type: 'activate', description: `Admin mở khóa tài khoản (bulk)`, data: {}, location_id: cust.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
      count++;
    }
    res.json({ message: `Đã mở khóa ${count} tài khoản` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/freeze', authenticateToken, async (req, res) => {
  try {
    const { ids, months } = req.body;
    const m = parseInt(months);
    if (!Array.isArray(ids) || !ids.length || !m || m<1 || m>10) return res.status(400).json({ error: 'Thiếu IDs hoặc months 1-10' });
    let count=0;
    for (const id of ids) {
      const pkgs = await UserPackage.find({ customer_id: id, status: { $in: ['đang hoạt động','còn 10 ngày'] }, payment_status: 'đã thanh toán' });
      for (const pkg of pkgs) {
        const frozenUntil=new Date(); frozenUntil.setMonth(frozenUntil.getMonth()+m);
        const newEnd=new Date(pkg.end_date); newEnd.setMonth(newEnd.getMonth()+m);
        pkg.frozenAt=new Date(); pkg.frozenUntil=frozenUntil; pkg.status='đang tạm ngưng'; pkg.end_date=newEnd; await pkg.save();
      }
      if (pkgs.length) {
        const cust = await Customer.findById(id).select('fullName phone locationId');
        await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'freeze', description: `Admin đóng băng (bulk) ${m} tháng`, data: { duration: m }, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
        count++;
      }
    }
    res.json({ message: `Đã đóng băng ${count} khách ${m} tháng` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/unfreeze', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách ID' });
    let count=0;
    for (const id of ids) {
      const pkgs = await UserPackage.find({ customer_id: id, status: 'đang tạm ngưng' });
      for (const pkg of pkgs) {
        if (pkg.frozenAt) {
          const elapsed = new Date() - new Date(pkg.frozenAt);
          const requested = pkg.frozenUntil ? new Date(pkg.frozenUntil) - new Date(pkg.frozenAt) : elapsed;
          const diffMs = Math.min(elapsed, requested);
          pkg.end_date = new Date(new Date(pkg.end_date).getTime() + diffMs);
        }
        pkg.status='đang hoạt động'; pkg.frozenAt=null; pkg.frozenUntil=null; await pkg.save();
      }
      if (pkgs.length) {
        const cust = await Customer.findById(id).select('fullName phone locationId');
        await ServiceRequest.create({ customer_id: id, customer_name: cust?.fullName||'', customer_phone: cust?.phone||'', service_type: 'activate', description: `Admin kích hoạt (bulk)`, data: {}, location_id: cust?.locationId||null, status: 'accepted', processed_by: req.user.id, processed_at: new Date() });
        count++;
      }
    }
    res.json({ message: `Đã kích hoạt ${count} khách` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/clear-face', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách ID' });
    let count = 0;
    for (const id of ids) {
      const cust = await Customer.findById(id);
      if (!cust) continue;
      if (!cust.faceDescriptor || cust.faceDescriptor.length === 0) continue;
      cust.faceDescriptor = [];
      await cust.save();
      count++;
    }
    res.json({ message: `Đã xóa FaceID của ${count} tài khoản (trở về chưa có FaceID)` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chuyển nhượng: Admin tạo hộ - xử lý thẳng, không cần phê duyệt (đi thẳng vào Tất cả)
router.post('/:id/transfer-request', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { packageId, recipient, reason } = req.body;
    if (!packageId || !recipient) return res.status(400).json({ error: 'Thiếu gói hoặc người nhận (SĐT/tài khoản)' });
    const cust = await Customer.findById(id).select('fullName phone locationId');
    if (!cust) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    const pkg = await UserPackage.findOne({ _id: packageId, customer_id: id });
    if (!pkg) return res.status(404).json({ error: 'Không tìm thấy gói của khách' });
    // Tìm người nhận để validate
    const recipientCust = await Customer.findOne({ $or: [{ phone: recipient }, { account: recipient }] }).select('_id fullName phone locationId');
    if (!recipientCust) return res.status(404).json({ error: 'Không tìm thấy người nhận với SĐT/tài khoản này' });
    if (String(recipientCust._id) === String(id)) return res.status(400).json({ error: 'Không thể chuyển cho chính mình' });
    // Kiểm tra cùng câu lạc bộ
    const senderLocationId = (pkg.locationId || cust.locationId)?.toString?.();
    const recipientLocationId = recipientCust.locationId?.toString?.();
    if (senderLocationId && recipientLocationId && senderLocationId !== recipientLocationId) {
      return res.status(400).json({ error: 'Không thể chuyển nhượng khác câu lạc bộ' });
    }
    // Thực hiện chuyển nhượng ngay (giống applyServiceEffect)
    const result = await UserPackage.updateMany(
      { customer_id: id, package_id: pkg.package_id, status: { $in: ['đang hoạt động', 'còn 10 ngày'] } },
      { $set: { customer_id: recipientCust._id } }
    );
    if (result.matchedCount === 0) {
      pkg.customer_id = recipientCust._id;
      await pkg.save();
    }
    // Tạo bản ghi dịch vụ đã duyệt thẳng (hiển thị ở Tất cả) - phân biệt bằng trạng thái Thành công
    const sr = await ServiceRequest.create({
      customer_id: id, customer_name: cust.fullName||'', customer_phone: cust.phone||'',
      service_type: 'transfer', description: reason ? `Chuyển nhượng: ${reason}` : `Admin tạo chuyển nhượng gói ${pkg.package_id} cho ${recipient}`,
      data: { packageId, recipient, recipientId: recipientCust._id, reason },
      location_id: cust.locationId||null, status: 'success', processed_by: req.user.id, processed_at: new Date(), admin_note: 'Nhân viên tạo từ danh sách khách hàng - Thành công'
    });
    // Thông báo cho người nhận
    try {
      const { createNotification } = await import('../models/notificationModel.js');
      createNotification({ recipientId: recipientCust._id, recipientRole: 'member', title: 'Gói tập được chuyển nhượng', message: `Hội viên "${cust.fullName}" đã chuyển nhượng gói tập cho bạn.`, type: 'service' }, () => {});
    } catch {}
    res.json({ message: 'Đã chuyển nhượng thành công (Thành công - do nhân viên tạo)', data: sr });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thuê tủ: Admin tạo hộ - duyệt thẳng (không cần phê duyệt, hiển thị ở Tất cả)
// Tủ đã được gán qua /api/v2/lockers/:id/assign ở FE, đây chỉ ghi lịch sử đã duyệt
router.post('/:id/locker-request', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { lockerId, lockerNumber, durationDays, reason } = req.body;
    if (!lockerId) return res.status(400).json({ error: 'Thiếu tủ' });
    const cust = await Customer.findById(id).select('fullName phone locationId');
    if (!cust) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    const days = Math.min(20, Math.max(1, parseInt(durationDays)||1));
    let lockerAmount = 0;
    try {
      if (cust.locationId) {
        const loc = await Location.findById(cust.locationId).select('serviceFees');
        const feeCfg = (loc?.serviceFees || []).find((f) => f.service_type === 'locker');
        if (feeCfg && feeCfg.hasFee && Number(feeCfg.fee) > 0) {
          lockerAmount = Math.floor(Number(feeCfg.fee) * days);
        }
      }
    } catch {}
    const sr = await ServiceRequest.create({
      customer_id: id, customer_name: cust.fullName||'', customer_phone: cust.phone||'',
      service_type: 'locker', description: reason ? `Thuê tủ: ${reason}` : `Nhân viên tạo thuê tủ ${lockerNumber||lockerId} ${days} ngày`,
      data: { lockerId, lockerNumber, durationDays: days, reason },
      location_id: cust.locationId||null, status: 'success',
      amount: lockerAmount, payment_status: lockerAmount > 0 ? 'paid' : 'unpaid', paid_at: lockerAmount > 0 ? new Date() : null,
      processed_by: req.user.id, processed_at: new Date(), admin_note: 'Nhân viên tạo từ danh sách khách hàng - Thành công'
    });
    res.json({ message: 'Đã ghi nhận thuê tủ (Thành công - do nhân viên tạo)', data: sr });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Hủy gói / Hoàn phí: Admin tạo hộ - duyệt thẳng (không cần phê duyệt)
router.post('/:id/cancel-refund-request', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { packageId, reason, noRefund } = req.body;
    if (!packageId) return res.status(400).json({ error: 'Thiếu gói' });
    const cust = await Customer.findById(id).select('fullName phone locationId');
    if (!cust) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    const pkg = await UserPackage.findOne({ _id: packageId, customer_id: id }).populate('package_id','name');
    if (!pkg) return res.status(404).json({ error: 'Không tìm thấy gói' });
    const desc = noRefund ? `Hủy gói ${pkg.package_id?.name||''} (KHÔNG hoàn tiền)${reason?`: ${reason}`:''}` : (reason ? `Hủy gói ${pkg.package_id?.name||''}: ${reason}` : `Admin tạo hủy gói ${pkg.package_id?.name||''}`);
    // Thực hiện hủy ngay
    pkg.status = 'đã hủy';
    await pkg.save();
    const sr = await ServiceRequest.create({
      customer_id: id, customer_name: cust.fullName||'', customer_phone: cust.phone||'',
      service_type: 'cancel-refund', description: desc,
      data: { packageId, reason, packageName: pkg.package_id?.name||'', noRefund: !!noRefund },
      location_id: cust.locationId||null, status: 'success', processed_by: req.user.id, processed_at: new Date(), admin_note: 'Nhân viên tạo từ danh sách khách hàng - Thành công'
    });
    res.json({ message: 'Đã hủy gói thành công (Thành công - do nhân viên tạo)', data: sr });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticateToken, async (req, res) => {
  const hasFaceId = req.query.hasFaceId;
  const hasActivePackage = req.query.hasActivePackage;
  // Nếu có filter đặc biệt -> xử lý riêng (kết hợp với list gốc để giữ phân trang)
  if (hasFaceId !== undefined || hasActivePackage !== undefined) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const locationId = req.query.locationId && req.query.locationId !== 'all' ? req.query.locationId : null;
      const baseFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};

      // FaceID filter
      if (hasFaceId === 'false') baseFilter.$or = [{ faceDescriptor: { $exists: false } }, { faceDescriptor: { $size: 0 } }];
      if (hasFaceId === 'true') baseFilter.faceDescriptor = { $exists: true, $not: { $size: 0 } };

      let customers = await Customer.find(baseFilter).sort({ createdAt: -1 }).lean();

      // ActivePackage filter: cần kiểm tra UserPackage
      if (hasActivePackage !== undefined) {
        const now = new Date();
        const activeIds = new Set(
          (await UserPackage.find({ payment_status: 'đã thanh toán', end_date: { $gte: now }, status: { $in: ['đang hoạt động','còn 10 ngày'] } }).select('customer_id').lean())
            .map(p => String(p.customer_id))
        );
        customers = customers.filter(c => {
          const hasActive = activeIds.has(String(c._id));
          return hasActivePackage === 'true' ? hasActive : !hasActive;
        });
      }

      const total = customers.length;
      const skip = (page - 1) * limit;
      const data = customers.slice(skip, skip + limit);
      return res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return list(req, res);
});
router.post('/register', register);
router.post('/login', login);
router.get('/search', authenticateToken, search);
router.get('/profile/:id', publicProfile);
router.get('/pending', authenticateToken, pendingList);
router.get('/my-info', authenticateToken, myInfo);
router.post('/submit-info', authenticateToken, handleUpload, submitInfo);
router.post('/avatar', authenticateToken, uploadDynamic('customers').single('avatar'), uploadAvatar);
router.post('/change-password', authenticateToken, changePassword);
router.get('/:id', authenticateToken, detail);
router.put('/:id', authenticateToken, handleUpload, update);
router.delete('/:id', authenticateToken, remove);
router.post('/:id/approve', authenticateToken, approve);
router.post('/:id/reject', authenticateToken, reject);

export default router;
