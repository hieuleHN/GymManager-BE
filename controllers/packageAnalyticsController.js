import mongoose from "mongoose";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Package from "../models/schemas/packageSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import Booking from "../models/schemas/bookingSchema.js";
import Location from "../models/schemas/locationSchema.js";
import Discipline from "../models/schemas/disciplineSchema.js";
import Job from "../models/schemas/jobSchema.js";

const toObjectId = (id) => {
  if (!id) return null;
  try { return new mongoose.Types.ObjectId(id); } catch { return id; }
};

const MONTHS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function getPeriodRange(period, startDate, endDate) {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  const prevStart = new Date();
  const prevEnd = new Date();

  if (startDate && endDate) {
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T23:59:59");
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24));
    start.setTime(s.getTime());
    end.setTime(e.getTime());
    prevStart.setTime(s.getTime() - diffDays * 86400000);
    prevEnd.setTime(s.getTime() - 1);
  } else if (period === "week") {
    start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
    end.setTime(now.getTime());
    prevStart.setDate(start.getDate() - 7); prevStart.setHours(0, 0, 0, 0);
    prevEnd.setDate(start.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
  } else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(q, 1); start.setHours(0, 0, 0, 0);
    end.setTime(now.getTime());
    prevStart.setMonth(q - 3, 1); prevStart.setHours(0, 0, 0, 0);
    prevEnd.setMonth(q, 0); prevEnd.setHours(23, 59, 59, 999);
  } else if (period === "year") {
    start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
    end.setTime(now.getTime());
    prevStart.setFullYear(now.getFullYear() - 1, 0, 1); prevStart.setHours(0, 0, 0, 0);
    prevEnd.setFullYear(now.getFullYear() - 1, 11, 31); prevEnd.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1); start.setHours(0, 0, 0, 0);
    end.setTime(now.getTime());
    prevStart.setMonth(now.getMonth() - 1, 1); prevStart.setHours(0, 0, 0, 0);
    prevEnd.setDate(0); prevEnd.setHours(23, 59, 59, 999);
  }

  const windowMs = (prevEnd.getTime() - prevStart.getTime()) + 1;
  const prevPrevEnd = new Date(prevStart.getTime() - 1);
  const prevPrevStart = new Date(prevPrevEnd.getTime() - windowMs + 1);

  return { start, end, prevStart, prevEnd, prevPrevStart, prevPrevEnd };
}

function expandMonthly(rows, rangeStart, rangeEnd) {
  const map = new Map();
  rows.forEach(r => map.set(`${r._id.year}-${r._id.month}`, r));
  const sY = rangeStart.getFullYear();
  const sM = rangeStart.getMonth();
  const eY = rangeEnd.getFullYear();
  const eM = rangeEnd.getMonth();
  const multiYear = sY !== eY;
  const out = [];
  let y = sY;
  let m = sM;
  while (y < eY || (y === eY && m <= eM)) {
    const found = map.get(`${y}-${m + 1}`);
    out.push({
      month: multiYear ? `T${m + 1}/${String(y).slice(2)}` : `T${m + 1}`,
      count: found?.count || 0,
      revenue: found?.revenue || 0,
    });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

function pctChange(cur, prev) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Number((((cur - prev) / prev) * 100).toFixed(1));
}

// ============================================================
// SECTION 1: Ownership & User List
// ============================================================
async function getOwnership(userPkgMatch, timeFilter) {
  const packages = await Package.find({});
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const ownershipAgg = await UserPackage.aggregate([
    { $match: { ...userPkgMatch, payment_status: "đã thanh toán", ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}) } },
    {
      $group: {
        _id: "$package_id",
        totalOwners: { $sum: 1 },
        activeCount: { $sum: { $cond: [{ $in: ["$status", ["đang hoạt động", "còn 10 ngày"]] }, 1, 0] } },
        expiredCount: { $sum: { $cond: [{ $eq: ["$status", "hết hạn"] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "đã hủy"] }, 1, 0] } },
        totalRevenue: { $sum: "$total_price" },
        durations: { $push: "$duration_months" },
      }
    },
  ]);

  const ownership = ownershipAgg.map(agg => {
    const pkg = pkgMap[agg._id?.toString()];
    const durationCounts = {};
    (agg.durations || []).forEach(d => { durationCounts[d] = (durationCounts[d] || 0) + 1; });
    return {
      packageId: agg._id,
      packageName: pkg?.name || "Gói không xác định",
      disciplineName: "",
      totalOwners: agg.totalOwners,
      activeCount: agg.activeCount,
      expiredCount: agg.expiredCount,
      cancelledCount: agg.cancelledCount,
      totalRevenue: agg.totalRevenue,
      avgRevenuePerPkg: agg.totalOwners ? Math.round(agg.totalRevenue / agg.totalOwners) : 0,
      durationDistribution: Object.entries(durationCounts).map(([months, count]) => ({
        months: Number(months), count
      })).sort((a, b) => a.months - b.months),
    };
  });

  for (const o of ownership) {
    const pkg = pkgMap[o.packageId?.toString()];
    if (pkg?.disciplineId) {
      const disc = await Discipline.findById(pkg.disciplineId).lean();
      o.disciplineName = disc?.name || "";
    }
  }

  ownership.sort((a, b) => b.totalOwners - a.totalOwners);
  return ownership;
}

// ============================================================
// SECTION 2: Check-in Frequency & Top Customers
// ============================================================
async function getCheckInFrequency(userPkgMatch, start, end) {
  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
  }).select("_id").lean();
  const pkgIds = userPkgs.map(u => u._id);
  if (pkgIds.length === 0) return { frequencyByPackage: [], topCustomers: [], avgCheckinsPerCustomer: 0 };

  const checkInMatch = { userPackageId: { $in: pkgIds }, checkInTime: { $gte: start, $lte: end } };

  const freqAgg = await CheckIn.aggregate([
    { $match: checkInMatch },
    { $group: { _id: "$userPackageId", count: { $sum: 1 } } },
  ]);

  const userPkgMap = {};
  userPkgs.forEach(u => { userPkgMap[u._id.toString()] = u; });

  const freqByPkgId = {};
  freqAgg.forEach(f => {
    const upId = f._id?.toString();
    const up = userPkgMap[upId];
    if (!up) return;
    const pkgId = up.package_id?.toString() || "unknown";
    if (!freqByPkgId[pkgId]) freqByPkgId[pkgId] = { total: 0, count: 0 };
    freqByPkgId[pkgId].total += f.count;
    freqByPkgId[pkgId].count += 1;
  });

  const packages = await Package.find({});
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const frequencyByPackage = Object.entries(freqByPkgId).map(([pkgId, data]) => ({
    packageName: pkgMap[pkgId]?.name || "Không xác định",
    avgCheckins: data.count ? Number((data.total / data.count).toFixed(1)) : 0,
    totalCheckins: data.total,
    userCount: data.count,
  }));

  const topCustomersAgg = await CheckIn.aggregate([
    { $match: checkInMatch },
    { $group: { _id: "$customerId", checkInCount: { $sum: 1 } } },
    { $sort: { checkInCount: -1 } },
    { $limit: 20 },
    {
      $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" }
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  ]);

  const topCustomers = topCustomersAgg.map(c => ({
    customerId: c._id,
    fullName: c.customer?.fullName || "Không xác định",
    phone: c.customer?.phone || "",
    gender: c.customer?.gender || "",
    checkInCount: c.checkInCount,
  }));

  const totalCheckins = freqAgg.reduce((s, f) => s + f.count, 0);
  const customersInPeriod = await CheckIn.distinct("customerId", checkInMatch);
  const avgCheckinsPerCustomer = customersInPeriod.length ? Number((totalCheckins / customersInPeriod.length).toFixed(1)) : 0;

  return { frequencyByPackage, topCustomers, avgCheckinsPerCustomer };
}

// ============================================================
// SECTION 3: PT Usage
// ============================================================
async function getPTUsage(userPkgMatch, timeFilter) {
  const trainerJobs = await Job.find({ name: { $regex: /huấn luyện viên|trainer|pt|hlv/i } }).lean();
  const trainerJobIds = trainerJobs.map(j => j._id);
  if (trainerJobIds.length === 0) return { ptStats: [], usedCount: 0, remainingCount: 0, fullyUsedPct: 0, wastedPct: 0 };

  const trainers = await Staff.find({ job: { $in: trainerJobIds } }).lean();
  const trainerIds = trainers.map(t => t._id);

  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    ptSessionsPerMonth: { $gt: 0 },
    ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}),
  }).lean();

  if (userPkgs.length === 0) return { ptStats: [], usedCount: 0, remainingCount: 0, fullyUsedPct: 0, wastedPct: 0 };

  let totalAllocated = 0;
  let totalUsed = 0;
  const ptBookingMatch = { trainerId: { $in: trainerIds }, status: "confirmed" };
  if (timeFilter.createdAt) ptBookingMatch.date = { $gte: timeFilter.createdAt.$gte, $lte: timeFilter.createdAt.$lte };
  const ptSessionAgg = await Booking.aggregate([
    { $match: ptBookingMatch },
    { $group: { _id: "$customerId", sessionCount: { $sum: 1 } } },
  ]);
  const customerSessionMap = {};
  ptSessionAgg.forEach(a => { customerSessionMap[a._id.toString()] = a.sessionCount; });

  let fullyUsedCount = 0;
  let wastedCount = 0;

  for (const up of userPkgs) {
    const allocated = (up.ptSessionsPerMonth || 0) * (up.duration_months || 1);
    totalAllocated += allocated;
    const used = customerSessionMap[up.customer_id?.toString()] || 0;
    totalUsed += used;
    if (allocated > 0 && used >= allocated) fullyUsedCount++;
    else if (allocated > 0 && used === 0) wastedCount++;
  }

  return {
    ptStats: userPkgs.length > 0 ? [{
      totalSessionsAllocated: totalAllocated,
      totalSessionsUsed: totalUsed,
      totalRemaining: Math.max(0, totalAllocated - totalUsed),
    }] : [],
    usedCount: totalUsed,
    remainingCount: Math.max(0, totalAllocated - totalUsed),
    fullyUsedPct: userPkgs.length ? Number(((fullyUsedCount / userPkgs.length) * 100).toFixed(1)) : 0,
    wastedPct: userPkgs.length ? Number(((wastedCount / userPkgs.length) * 100).toFixed(1)) : 0,
    totalPkgWithPT: userPkgs.length,
    fullyUsedCount,
    wastedCount,
  };
}

// ============================================================
// SECTION 4: Actual Stay Duration
// ============================================================
async function getStayDuration(userPkgMatch, start, end) {
  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    status: { $in: ["đang hoạt động", "còn 10 ngày", "hết hạn"] },
  }).lean();

  if (userPkgs.length === 0) return { avgStayMinutes: 0, medianStayMinutes: 0, distribution: [] };

  const pkgIds = userPkgs.map(u => u._id);
  const checkins = await CheckIn.find({
    userPackageId: { $in: pkgIds },
    checkInTime: { $gte: start, $lte: end },
    $or: [{ checkOutTime: { $ne: null } }, { status: "checked-out" }],
  }).lean();

  if (checkins.length === 0) return { avgStayMinutes: 0, medianStayMinutes: 0, distribution: [] };

  const durations = checkins
    .filter(c => c.checkOutTime && c.checkInTime)
    .map(c => (new Date(c.checkOutTime) - new Date(c.checkInTime)) / 60000)
    .filter(d => d > 0 && d < 600);

  if (durations.length === 0) return { avgStayMinutes: 0, medianStayMinutes: 0, distribution: [] };

  durations.sort((a, b) => a - b);
  const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  const median = Math.round(durations[Math.floor(durations.length / 2)]);

  const buckets = [
    { label: "< 30 phút", min: 0, max: 30, count: 0 },
    { label: "30-60 phút", min: 30, max: 60, count: 0 },
    { label: "60-90 phút", min: 60, max: 90, count: 0 },
    { label: "90-120 phút", min: 90, max: 120, count: 0 },
    { label: "> 120 phút", min: 120, max: Infinity, count: 0 },
  ];
  durations.forEach(d => {
    const b = buckets.find(b => d >= b.min && d < b.max);
    if (b) b.count++;
  });

  return { avgStayMinutes: avg, medianStayMinutes: median, distribution: buckets.map(b => ({ label: b.label, count: b.count, pct: Number(((b.count / durations.length) * 100).toFixed(1)) })) };
}

// ============================================================
// SECTION 5: Sales Velocity
// ============================================================
async function getSalesVelocity(userPkgMatch, timeFilter) {
  const start = timeFilter.createdAt.$gte;
  const end = timeFilter.createdAt.$lte;
  const match = { ...userPkgMatch, payment_status: "đã thanh toán" };
  if (timeFilter.createdAt) match.createdAt = timeFilter.createdAt;

  const monthlySales = await UserPackage.aggregate([
    { $match: match },
    { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, count: { $sum: 1 }, revenue: { $sum: "$total_price" } } },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const salesByMonth = expandMonthly(monthlySales, start, end);

  const lastEntry = salesByMonth[salesByMonth.length - 1];
  const prevEntry = salesByMonth.length > 1 ? salesByMonth[salesByMonth.length - 2] : null;

  const activeMonths = salesByMonth.filter(s => s.count > 0);

  return {
    monthlySales: salesByMonth,
    thisMonthSales: lastEntry?.count || 0,
    thisMonthRevenue: lastEntry?.revenue || 0,
    salesGrowthMoM: prevEntry ? pctChange(lastEntry?.count || 0, prevEntry.count) : 0,
    avgMonthlySales: activeMonths.length
      ? Math.round(activeMonths.reduce((s, m) => s + m.count, 0) / activeMonths.length)
      : 0,
  };
}

// ============================================================
// SECTION 6: Revenue by Package & ARPU
// ============================================================
async function getRevenueByPackage(userPkgMatch, timeFilter) {
  const packages = await Package.find({});
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const match = { ...userPkgMatch, payment_status: "đã thanh toán" };
  if (timeFilter.createdAt) match.createdAt = timeFilter.createdAt;

  const revAgg = await UserPackage.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$package_id",
        totalRevenue: { $sum: "$total_price" },
        count: { $sum: 1 },
        avgPrice: { $avg: "$total_price" },
      }
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  const totalRevenue = revAgg.reduce((s, r) => s + r.totalRevenue, 0);
  const totalUsers = revAgg.reduce((s, r) => s + r.count, 0);
  const arpu = totalUsers ? Math.round(totalRevenue / totalUsers) : 0;

  const byPackage = revAgg.map(r => ({
    packageId: r._id,
    packageName: pkgMap[r._id?.toString()]?.name || "Không xác định",
    revenue: r.totalRevenue,
    count: r.count,
    avgPrice: Math.round(r.avgPrice),
    revenueShare: totalRevenue ? Number(((r.totalRevenue / totalRevenue) * 100).toFixed(1)) : 0,
  }));

  return { byPackage, totalRevenue, totalUsers, arpu };
}

// ============================================================
// SECTION 7: Churn & Renewal Rates + MoM
// ============================================================
async function getChurnRenewal(userPkgMatch, prevUserPkgMatch) {
  async function calcRates(match) {
    const total = await UserPackage.countDocuments({ ...match, payment_status: "đã thanh toán" });
    if (total === 0) return { total: 0, renewalCount: 0, churnCount: 0, renewalRate: 0, churnRate: 0 };

    const renewalCount = await UserPackage.countDocuments({
      ...match, payment_status: "đã thanh toán", is_renewal_ticket: true
    });

    const churnCount = await UserPackage.countDocuments({
      ...match, payment_status: "đã thanh toán",
      status: { $in: ["hết hạn", "đã hủy"] },
    });

    return {
      total,
      renewalCount,
      churnCount,
      renewalRate: total ? Number(((renewalCount / total) * 100).toFixed(1)) : 0,
      churnRate: total ? Number(((churnCount / total) * 100).toFixed(1)) : 0,
    };
  }

  const current = await calcRates(userPkgMatch);
  const previous = await calcRates(prevUserPkgMatch);

  return {
    current,
    previous,
    renewalChangeMoM: pctChange(current.renewalRate, previous.renewalRate),
    churnChangeMoM: pctChange(current.churnRate, previous.churnRate),
  };
}

// ============================================================
// SECTION 8: Repurchase Cycle & Purchase Timing
// ============================================================
async function getRepurchaseTiming(userPkgMatch, timeFilter) {
  const match = { ...userPkgMatch, payment_status: "đã thanh toán" };
  if (timeFilter.createdAt) match.createdAt = timeFilter.createdAt;

  const userPkgs = await UserPackage.find(match).sort({ customer_id: 1, createdAt: 1 }).lean();

  const customerPkgMap = {};
  userPkgs.forEach(up => {
    const cid = up.customer_id?.toString();
    if (!cid) return;
    if (!customerPkgMap[cid]) customerPkgMap[cid] = [];
    customerPkgMap[cid].push(up);
  });

  const repurchaseDiffs = [];
  Object.values(customerPkgMap).forEach(pkgs => {
    if (pkgs.length < 2) return;
    for (let i = 1; i < pkgs.length; i++) {
      const diff = (new Date(pkgs[i].createdAt) - new Date(pkgs[i - 1].createdAt)) / (1000 * 60 * 60 * 24);
      if (diff > 0) repurchaseDiffs.push(Math.round(diff));
    }
  });

  const avgRepurchaseDays = repurchaseDiffs.length
    ? Math.round(repurchaseDiffs.reduce((s, d) => s + d, 0) / repurchaseDiffs.length)
    : 0;

  const monthlyPurchases = await UserPackage.aggregate([
    { $match: match },
    { $project: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } } },
    {
      $group: {
        _id: { month: "$month", year: "$year" },
        count: { $sum: 1 },
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const purchaseByMonth = expandMonthly(monthlyPurchases, timeFilter.createdAt.$gte, timeFilter.createdAt.$lte);

  const hourlyAgg = await UserPackage.aggregate([
    { $match: match },
    { $project: { hour: { $hour: "$createdAt" } } },
    { $group: { _id: "$hour", count: { $sum: 1 } } },
    { $sort: { "_id": 1 } },
  ]);

  const purchaseByHour = [];
  for (let h = 0; h < 6; h++) {
    const found = hourlyAgg.find(a => a._id === h);
    purchaseByHour.push({ hour: `${h}h`, count: found?.count || 0 });
  }
  for (let h = 6; h <= 22; h++) {
    const found = hourlyAgg.find(a => a._id === h);
    purchaseByHour.push({ hour: `${h}h`, count: found?.count || 0 });
  }
  for (let h = 23; h < 24; h++) {
    const found = hourlyAgg.find(a => a._id === h);
    purchaseByHour.push({ hour: `${h}h`, count: found?.count || 0 });
  }

  return { avgRepurchaseDays, repurchaseCount: repurchaseDiffs.length, purchaseByMonth, purchaseByHour };
}

// ============================================================
// SECTION 9: Multi-Package & Upgrade Analysis
// ============================================================
async function getMultiPackageAnalysis(userPkgMatch, timeFilter) {
  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}),
  }).populate("package_id", "name price").lean();

  const customerPkgs = {};
  userPkgs.forEach(up => {
    const cid = up.customer_id?.toString();
    if (!cid) return;
    if (!customerPkgs[cid]) customerPkgs[cid] = [];
    customerPkgs[cid].push(up);
  });

  const multiPkgCustomers = Object.entries(customerPkgs)
    .filter(([, pkgs]) => pkgs.length > 1)
    .map(([customerId, pkgs]) => ({
      customerId,
      packageCount: pkgs.length,
      packages: pkgs.map(p => ({
        name: p.package_id?.name || "N/A",
        price: p.package_id?.price || 0,
        startDate: p.start_date,
        endDate: p.end_date,
      })),
    }));

  let upgradeCount = 0;
  let totalMultiPkg = multiPkgCustomers.length;

  multiPkgCustomers.forEach(c => {
    for (let i = 1; i < c.packages.length; i++) {
      const prevPrice = c.packages[i - 1].price || 0;
      const curPrice = c.packages[i].price || 0;
      if (curPrice > prevPrice) upgradeCount++;
    }
  });

  const coPurchasePairs = {};
  multiPkgCustomers.forEach(c => {
    const names = c.packages.map(p => p.name).sort();
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]} + ${names[j]}`;
        coPurchasePairs[key] = (coPurchasePairs[key] || 0) + 1;
      }
    }
  });

  const coPurchases = Object.entries(coPurchasePairs)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    multiPkgCustomers,
    multiPkgCount: totalMultiPkg,
    upgradeCount,
    upgradeRate: totalMultiPkg ? Number(((upgradeCount / totalMultiPkg) * 100).toFixed(1)) : 0,
    coPurchases,
  };
}

// ============================================================
// SECTION 10: Package Health Score (Đỏ/Vàng/Xanh)
// ============================================================
async function getPackageHealthScore(userPkgMatch, ranges) {
  const { start, end, prevStart, prevEnd, prevPrevStart, prevPrevEnd } = ranges;

  const packages = await Package.find({});
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const healthScores = [];

  for (const pkg of packages) {
    const pkgId = pkg._id;
    const baseMatch = { ...userPkgMatch, package_id: pkgId, payment_status: "đã thanh toán" };

    const curSales = await UserPackage.countDocuments({ ...baseMatch, createdAt: { $gte: start, $lte: end } });
    const prevSales = await UserPackage.countDocuments({ ...baseMatch, createdAt: { $gte: prevStart, $lte: prevEnd } });
    const prevPrevSales = await UserPackage.countDocuments({ ...baseMatch, createdAt: { $gte: prevPrevStart, $lte: prevPrevEnd } });

    const allPkgIds = (await UserPackage.find(baseMatch).select("_id").lean()).map(u => u._id);

    const curCheckins = allPkgIds.length ? await CheckIn.countDocuments({ userPackageId: { $in: allPkgIds }, checkInTime: { $gte: start, $lte: end } }) : 0;
    const prevCheckins = allPkgIds.length ? await CheckIn.countDocuments({ userPackageId: { $in: allPkgIds }, checkInTime: { $gte: prevStart, $lte: prevEnd } }) : 0;
    const prevPrevCheckins = allPkgIds.length ? await CheckIn.countDocuments({ userPackageId: { $in: allPkgIds }, checkInTime: { $gte: prevPrevStart, $lte: prevPrevEnd } }) : 0;

    let score = 50;

    // Doanh số 2 kỳ gần
    if (curSales > prevSales) score += 15;
    else if (curSales < prevSales) score -= 20;

    // Tần suất điểm danh
    if (curCheckins > prevCheckins) score += 10;
    else if (curCheckins < prevCheckins) score -= 10;

    if (curSales === 0 && prevSales === 0 && prevPrevSales === 0) score = 15;
    else if (curSales === 0 && prevSales === 0) score = 25;

    let color = "xanh";
    if (score >= 60) color = "xanh";
    else if (score >= 40) color = "vàng";
    else color = "đỏ";

    // Cảnh báo giảm 2 kỳ liên tiếp: cur < prev < prevPrev
    const consecutiveDecline = prevPrevSales > prevSales && prevSales > curSales && prevSales > 0;

    healthScores.push({
      packageId: pkgId,
      packageName: pkg.name,
      score: Math.max(0, Math.min(100, score)),
      color,
      recentSales: curSales,
      previousSales: prevSales,
      lastTwoMonthsSales: prevPrevSales,
      recentCheckins: curCheckins,
      previousCheckins: prevCheckins,
      consecutiveDecline,
      warning: consecutiveDecline ? "Cảnh báo: Doanh số giảm 2 kỳ liên tiếp" : null,
    });
  }

  healthScores.sort((a, b) => a.score - b.score);
  return healthScores;
}

// ============================================================
// SECTION 11: Cross-Package & Branch Comparison
// ============================================================
async function getCrossComparison(userPkgMatch, timeFilter) {
  const allUserPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}),
  }).populate("package_id", "name disciplineId locationId").lean();

  const packages = await Package.find({}).lean();
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const disciplines = await Discipline.find({}).lean();
  const discMap = {};
  disciplines.forEach(d => { discMap[d._id.toString()] = d; });

  const byDiscipline = {};
  allUserPkgs.forEach(up => {
    const pkg = pkgMap[up.package_id?.toString()];
    const discId = pkg?.disciplineId?.toString() || "none";
    const discName = discMap[discId]?.name || "Chưa phân loại";
    if (!byDiscipline[discName]) byDiscipline[discName] = { revenue: 0, count: 0, packages: {} };
    byDiscipline[discName].revenue += up.total_price || 0;
    byDiscipline[discName].count += 1;
    const pkgName = pkg?.name || "N/A";
    if (!byDiscipline[discName].packages[pkgName]) byDiscipline[discName].packages[pkgName] = { revenue: 0, count: 0 };
    byDiscipline[discName].packages[pkgName].revenue += up.total_price || 0;
    byDiscipline[discName].packages[pkgName].count += 1;
  });

  const locations = await Location.find({}).lean();
  const locMap = {};
  locations.forEach(l => { locMap[l._id.toString()] = l; });

  const byBranch = {};
  allUserPkgs.forEach(up => {
    const locId = up.locationId?.toString() || up.package_id?.toString();
    const locName = locMap[up.locationId?.toString()]?.address || up.locationId?.toString() || "Chưa rõ";
    if (!byBranch[locName]) byBranch[locName] = { revenue: 0, count: 0 };
    byBranch[locName].revenue += up.total_price || 0;
    byBranch[locName].count += 1;
  });

  const disciplineComparison = Object.entries(byDiscipline).map(([name, data]) => ({
    discipline: name,
    revenue: data.revenue,
    count: data.count,
    avgPrice: data.count ? Math.round(data.revenue / data.count) : 0,
    packages: Object.entries(data.packages).map(([pkgName, pkgData]) => ({
      packageName: pkgName,
      revenue: pkgData.revenue,
      count: pkgData.count,
    })).sort((a, b) => b.revenue - a.revenue),
  })).sort((a, b) => b.revenue - a.revenue);

  const branchComparison = Object.entries(byBranch).map(([name, data]) => ({
    branch: name,
    revenue: data.revenue,
    count: data.count,
    avgPrice: data.count ? Math.round(data.revenue / data.count) : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  return { disciplineComparison, branchComparison };
}

// ============================================================
// SECTION 12: Revenue Target & Forecast
// ============================================================
async function getRevenueForecast(userPkgMatch, timeFilter) {
  const start = timeFilter.createdAt.$gte;
  const end = timeFilter.createdAt.$lte;

  const monthlySales = await UserPackage.aggregate([
    { $match: { ...userPkgMatch, payment_status: "đã thanh toán", ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}) } },
    { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, count: { $sum: 1 }, revenue: { $sum: "$total_price" } } },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const revenueByMonth = expandMonthly(monthlySales, start, end);

  const pastMonths = revenueByMonth.filter(m => m.revenue > 0);
  const avgMonthlyRevenue = pastMonths.length
    ? Math.round(pastMonths.reduce((s, m) => s + m.revenue, 0) / pastMonths.length)
    : 0;

  const currentMonthIdx = end.getMonth();
  const forecastMonths = 3;
  const forecast = [];
  for (let i = 1; i <= forecastMonths; i++) {
    const futureMonth = currentMonthIdx + i;
    const futureIdx = futureMonth % 12;
    forecast.push({
      month: MONTHS[futureIdx],
      forecastRevenue: avgMonthlyRevenue,
      confidence: Math.max(30, 90 - i * 20),
    });
  }

  const ytd = revenueByMonth.reduce((s, m) => s + m.revenue, 0);

  return { revenueByMonth, avgMonthlyRevenue, forecast, ytdRevenue: ytd, currentMonth: MONTHS[currentMonthIdx] };
}

// ============================================================
// SECTION 13: Retention Cohort
// ============================================================
async function getRetentionCohort(userPkgMatch, timeFilter) {
  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}),
  }).sort({ createdAt: 1 }).lean();

  if (userPkgs.length < 5) return { cohorts: [], insufficientData: true };

  const cohortMap = {};
  userPkgs.forEach(up => {
    const date = new Date(up.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!cohortMap[key]) cohortMap[key] = [];
    cohortMap[key].push(up);
  });

  const now = new Date();
  const cohorts = Object.entries(cohortMap).map(([cohortMonth, pkgs]) => {
    const cohortDate = new Date(cohortMonth + "-01");
    const monthsDiff = (now.getFullYear() - cohortDate.getFullYear()) * 12 + now.getMonth() - cohortDate.getMonth();

    const totalInCohort = pkgs.length;
    const stillActive1 = pkgs.filter(p => {
      const endDate = new Date(p.end_date);
      return endDate >= new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 1);
    }).length;

    const stillActive2 = pkgs.filter(p => {
      const endDate = new Date(p.end_date);
      return endDate >= new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 2, 1);
    }).length;

    const stillActive3 = pkgs.filter(p => {
      const endDate = new Date(p.end_date);
      return endDate >= new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 3, 1);
    }).length;

    return {
      cohortMonth,
      totalCustomers: totalInCohort,
      retainedMonth1: monthsDiff >= 1 ? Number(((stillActive1 / totalInCohort) * 100).toFixed(1)) : null,
      retainedMonth2: monthsDiff >= 2 ? Number(((stillActive2 / totalInCohort) * 100).toFixed(1)) : null,
      retainedMonth3: monthsDiff >= 3 ? Number(((stillActive3 / totalInCohort) * 100).toFixed(1)) : null,
    };
  });

  return { cohorts: cohorts.slice(-12), insufficientData: false };
}

// ============================================================
// SECTION 14: LTV by Package
// ============================================================
async function getLTV(userPkgMatch, timeFilter) {
  const allUserPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
    ...(timeFilter.createdAt ? { createdAt: timeFilter.createdAt } : {}),
  }).lean();

  if (allUserPkgs.length === 0) return { ltvByPackage: [], overallLTV: 0 };

  const customerPkgSpend = {};
  allUserPkgs.forEach(up => {
    const cid = up.customer_id?.toString();
    const pid = up.package_id?.toString();
    if (!cid || !pid) return;
    if (!customerPkgSpend[cid]) customerPkgSpend[cid] = {};
    customerPkgSpend[cid][pid] = (customerPkgSpend[cid][pid] || 0) + (up.total_price || 0);
  });

  const packages = await Package.find({}).lean();
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const pkgTotalSpend = {};
  const pkgCustomerCount = {};

  Object.values(customerPkgSpend).forEach(pkgSpend => {
    Object.entries(pkgSpend).forEach(([pkgId, spend]) => {
      pkgTotalSpend[pkgId] = (pkgTotalSpend[pkgId] || 0) + spend;
      pkgCustomerCount[pkgId] = (pkgCustomerCount[pkgId] || 0) + 1;
    });
  });

  const totalAllSpend = Object.values(pkgTotalSpend).reduce((s, v) => s + v, 0);
  const totalAllCustomers = Object.keys(customerPkgSpend).length;

  const ltvByPackage = Object.entries(pkgTotalSpend).map(([pkgId, totalSpend]) => ({
    packageId: pkgId,
    packageName: pkgMap[pkgId]?.name || "Không xác định",
    totalRevenue: totalSpend,
    customerCount: pkgCustomerCount[pkgId] || 0,
    ltv: pkgCustomerCount[pkgId] ? Math.round(totalSpend / pkgCustomerCount[pkgId]) : 0,
  })).sort((a, b) => b.ltv - a.ltv);

  const overallLTV = totalAllCustomers ? Math.round(totalAllSpend / totalAllCustomers) : 0;

  return { ltvByPackage, overallLTV };
}

// ============================================================
// SECTION 15: Check-in Heatmap by Package
// ============================================================
async function getCheckInHeatmap(userPkgMatch, start, end) {
  const userPkgs = await UserPackage.find({
    ...userPkgMatch,
    payment_status: "đã thanh toán",
  }).populate("package_id", "name").lean();

  if (userPkgs.length === 0) return { heatmap: [], insufficientData: true };

  const pkgCheckInMap = {};
  userPkgs.forEach(up => {
    const pkgName = up.package_id?.name || "N/A";
    pkgCheckInMap[up._id.toString()] = pkgName;
  });

  const userPkgIds = userPkgs.map(u => u._id);
  if (userPkgIds.length === 0) return { heatmap: [], insufficientData: true };

  const checkins = await CheckIn.find({
    userPackageId: { $in: userPkgIds },
    checkInTime: { $gte: start, $lte: end },
  }).select("userPackageId checkInTime").lean();

  if (checkins.length < 10) return { heatmap: [], insufficientData: true };

  const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const hours = [];
  for (let h = 6; h <= 22; h++) hours.push(`${h}h`);

  const heatmapData = {};

  checkins.forEach(c => {
    const pkgName = pkgCheckInMap[c.userPackageId?.toString()] || "N/A";
    const d = new Date(c.checkInTime);
    const day = DAYS[d.getDay()];
    const hour = `${d.getHours()}h`;

    if (!heatmapData[pkgName]) {
      heatmapData[pkgName] = {};
      DAYS.forEach(day => {
        heatmapData[pkgName][day] = {};
        hours.forEach(h => { heatmapData[pkgName][day][h] = 0; });
      });
    }
    if (heatmapData[pkgName][day] && heatmapData[pkgName][day][hour] !== undefined) {
      heatmapData[pkgName][day][hour]++;
    }
  });

  const heatmap = Object.entries(heatmapData).map(([packageName, days]) => ({
    packageName,
    data: DAYS.map(day => ({
      day,
      hours: hours.map(h => ({ hour: h, count: days[day]?.[h] || 0 })),
    })),
  }));

  return { heatmap, insufficientData: false };
}

// ============================================================
// SECTION 16: Pareto 80/20
// ============================================================
async function getPareto(userPkgMatch, timeFilter) {
  const match = { ...userPkgMatch, payment_status: "đã thanh toán" };
  if (timeFilter.createdAt) match.createdAt = timeFilter.createdAt;

  const revAgg = await UserPackage.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$package_id",
        revenue: { $sum: "$total_price" },
        count: { $sum: 1 },
      }
    },
    { $sort: { revenue: -1 } },
  ]);

  const packages = await Package.find({}).lean();
  const pkgMap = {};
  packages.forEach(p => { pkgMap[p._id.toString()] = p; });

  const totalRevenue = revAgg.reduce((s, r) => s + r.revenue, 0);
  if (totalRevenue === 0) return { pareto: [], top20PctRevenue: 0, top20PctPackages: 0 };

  let cumulative = 0;
  const pareto = revAgg.map((r, i) => {
    cumulative += r.revenue;
    return {
      packageName: pkgMap[r._id?.toString()]?.name || "N/A",
      revenue: r.revenue,
      count: r.count,
      cumulativePct: Number(((cumulative / totalRevenue) * 100).toFixed(1)),
      rank: i + 1,
    };
  });

  const threshold80 = pareto.find(p => p.cumulativePct >= 80);
  const top20Idx = threshold80 ? threshold80.rank : pareto.length;
  const top20PkgCount = Math.max(1, Math.ceil(pareto.length * 0.2));
  const top20Revenue = pareto.slice(0, top20PkgCount).reduce((s, p) => s + p.revenue, 0);

  return {
    pareto,
    top20PctRevenue: Number(((top20Revenue / totalRevenue) * 100).toFixed(1)),
    top20PctPackages: top20PkgCount,
    totalPackages: pareto.length,
    paretoAt80Pct: threshold80 ? threshold80.rank : null,
  };
}

// ============================================================
// SECTION 17: Demographics (Age/Gender by Package)
// ============================================================
async function getDemographics(userPkgMatch, timeFilter) {
  const match = { ...userPkgMatch, payment_status: "đã thanh toán" };
  if (timeFilter.createdAt) match.createdAt = timeFilter.createdAt;

  const userPkgs = await UserPackage.find(match).populate("customer_id", "fullName gender birthDate registerDate age").populate("package_id", "name").lean();

  if (userPkgs.length === 0) return { genderByPackage: [], ageByPackage: [], totalBuyers: 0 };

  const genderData = {};
  const ageData = {};

  userPkgs.forEach(up => {
    const pkgName = up.package_id?.name || "N/A";
    const gender = up.customer_id?.gender || "Khác";

    if (!genderData[pkgName]) genderData[pkgName] = { Nam: 0, "Nữ": 0, "Khác": 0 };
    genderData[pkgName][gender] = (genderData[pkgName][gender] || 0) + 1;

    let age = up.customer_id?.age;
    if (!age && up.customer_id?.birthDate) {
      const bd = new Date(up.customer_id.birthDate);
      age = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    if (age != null && age >= 0 && age <= 100) {
      let ageGroup = "< 18";
      if (age >= 18 && age < 25) ageGroup = "18-24";
      else if (age >= 25 && age < 35) ageGroup = "25-34";
      else if (age >= 35 && age < 45) ageGroup = "35-44";
      else if (age >= 45) ageGroup = "45+";

      if (!ageData[pkgName]) ageData[pkgName] = { "< 18": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45+": 0 };
      ageData[pkgName][ageGroup] = (ageData[pkgName][ageGroup] || 0) + 1;
    }
  });

  const genderByPackage = Object.entries(genderData).map(([packageName, counts]) => {
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    return {
      packageName,
      male: counts["Nam"] || 0,
      female: counts["Nữ"] || 0,
      other: counts["Khác"] || 0,
      total,
    };
  });

  const ageByPackage = Object.entries(ageData).map(([packageName, counts]) => {
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    return { packageName, ...counts, total };
  });

  return { genderByPackage, ageByPackage, totalBuyers: userPkgs.length };
}

// ============================================================
// MAIN CONTROLLER
// ============================================================
export const getPackageAnalytics = async (req, res) => {
  try {
    const locationId = toObjectId(req.query.locationId);
    const packageId = toObjectId(req.query.packageId);
    const { start, end, prevStart, prevEnd, prevPrevStart, prevPrevEnd } = getPeriodRange(
      req.query.period || "month",
      req.query.startDate,
      req.query.endDate
    );

    console.log(`[PackageAnalytics] period=${req.query.period || "month"} range=${start.toISOString()} → ${end.toISOString()} | prev=${prevStart.toISOString()} → ${prevEnd.toISOString()} | pkg=${req.query.packageId || "-"} loc=${req.query.locationId || "-"}`);

    const baseMatch = {};
    if (locationId) baseMatch.locationId = locationId;

    const userPkgMatch = { ...baseMatch };
    if (packageId) userPkgMatch.package_id = packageId;

    const prevUserPkgMatch = { ...baseMatch, createdAt: { $gte: prevStart, $lte: prevEnd } };
    if (packageId) prevUserPkgMatch.package_id = packageId;

    // Mọi period/custom date đều áp dụng bộ lọc thời gian thực tế lên toàn bộ section.
    const timeFilter = { createdAt: { $gte: start, $lte: end } };

    const ranges = { start, end, prevStart, prevEnd, prevPrevStart, prevPrevEnd };

    const [
      ownership,
      checkInFrequency,
      ptUsage,
      stayDuration,
      salesVelocity,
      revenueByPackage,
      churnRenewal,
      repurchaseTiming,
      multiPackageAnalysis,
      packageHealth,
      crossComparison,
      revenueForecast,
      retentionCohort,
      ltv,
      checkInHeatmap,
      pareto,
      demographics,
    ] = await Promise.all([
      getOwnership(userPkgMatch, timeFilter),
      getCheckInFrequency(userPkgMatch, start, end),
      getPTUsage(userPkgMatch, timeFilter),
      getStayDuration(userPkgMatch, start, end),
      getSalesVelocity(userPkgMatch, timeFilter),
      getRevenueByPackage(userPkgMatch, timeFilter),
      getChurnRenewal({ ...userPkgMatch, createdAt: { $gte: start, $lte: end } }, prevUserPkgMatch),
      getRepurchaseTiming(userPkgMatch, timeFilter),
      getMultiPackageAnalysis(userPkgMatch, timeFilter),
      getPackageHealthScore(userPkgMatch, ranges),
      getCrossComparison(userPkgMatch, timeFilter),
      getRevenueForecast(userPkgMatch, timeFilter),
      getRetentionCohort(userPkgMatch, timeFilter),
      getLTV(userPkgMatch, timeFilter),
      getCheckInHeatmap(userPkgMatch, start, end),
      getPareto(userPkgMatch, timeFilter),
      getDemographics(userPkgMatch, timeFilter),
    ]);

    const packages = await Package.find({}).lean();
    const locations = await Location.find({}).lean();

    return res.status(200).json({
      filters: {
        packages: packages.map(p => ({ id: p._id, name: p.name, lifecycle_status: p.lifecycle_status })),
        locations: locations.map(l => ({ id: l._id, name: l.address || l.title })),
      },
      ownership,
      checkInFrequency,
      ptUsage,
      stayDuration,
      salesVelocity,
      revenueByPackage,
      churnRenewal,
      repurchaseTiming,
      multiPackageAnalysis,
      packageHealth,
      crossComparison,
      revenueForecast,
      retentionCohort,
      ltv,
      checkInHeatmap,
      pareto,
      demographics,
    });
  } catch (err) {
    console.error("Package analytics error:", err);
    return res.status(500).json({ error: err.message });
  }
};
