import UserPackage from "../models/schemas/userPackageSchema.js";
import Expense from "../models/schemas/expenseSchema.js";
import WalletTransaction from "../models/schemas/walletTransactionSchema.js";
import Package from "../models/schemas/packageSchema.js";
import Product from "../models/schemas/productSchema.js";
import Equipment from "../models/schemas/equipmentSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";
import Booking from "../models/schemas/bookingSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import Staff from "../models/schemas/staffSchema.js";
import Location from "../models/schemas/locationSchema.js";
import mongoose from "mongoose";

const toObjectId = (id) => {
  if (!id) return null;
  try { return new mongoose.Types.ObjectId(id); } catch { return id; }
};

const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

// Trả về { start, prevStart } dựa trên period
function getPeriodRange(period) {
  const now = new Date();
  const start = new Date();
  const prevStart = new Date();
  const prevEnd = new Date();

  if (period === "week") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    prevStart.setDate(start.getDate() - 7);
    prevEnd.setDate(start.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(q, 1);
    start.setHours(0, 0, 0, 0);
    prevStart.setMonth(q - 3, 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setMonth(q, 0);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    prevStart.setFullYear(now.getFullYear() - 1, 0, 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setMonth(0, 0);
    prevEnd.setHours(23, 59, 59, 999);
  } else {
    // month (default)
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    prevStart.setMonth(now.getMonth() - 1, 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setDate(0);
    prevEnd.setHours(23, 59, 59, 999);
  }

  return { start, prevStart, prevEnd };
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

// Nhóm doanh thu/thu chi theo tháng trong năm hiện tại
async function monthlySeries(Model, amountField, dateField, matchExtra = {}, fallbackDateField = null) {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = new Date(year, 0, 1);

  const results = await Promise.all(MONTHS.map(async (label, idx) => {
    const mStart = new Date(year, idx, 1);
    const isCurrentMonth = (idx === now.getMonth());
    const mEnd = isCurrentMonth ? now : new Date(year, idx + 1, 0, 23, 59, 59, 999);

    let filter;
    if (fallbackDateField) {
      filter = {
        $or: [
          { [dateField]: { $gte: mStart, $lte: mEnd } },
          { $and: [{ $or: [{ [dateField]: null }, { [dateField]: { $exists: false } }] }, { [fallbackDateField]: { $gte: mStart, $lte: mEnd } }] },
        ],
        ...matchExtra,
      };
    } else {
      filter = { [dateField]: { $gte: mStart, $lte: mEnd }, ...matchExtra };
    }

    const rows = await Model.aggregate([
      { $match: filter },
      { $group: { _id: null, value: { $sum: `$${amountField}` } } },
    ]);
    return { month: label, value: rows[0]?.value || 0 };
  }));

  return results;
}

// Tổng theo khoảng thời gian
async function sumBetween(Model, amountField, dateField, start, end, matchExtra = {}, fallbackDateField = null) {
  let filter;
  if (fallbackDateField) {
    filter = {
      $or: [
        { [dateField]: { $gte: start, $lte: end } },
        {
          $and: [
            { $or: [{ [dateField]: null }, { [dateField]: { $exists: false } }] },
            { [fallbackDateField]: { $gte: start, $lte: end } },
          ],
        },
      ],
      ...matchExtra,
    };
  } else {
    filter = {
      [dateField]: { $gte: start, $lte: end },
      ...matchExtra,
    };
  }
  const result = await Model.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: `$${amountField}` } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
}

export const getFinanceStatistics = async (req, res) => {
  try {
    const period = req.query.period || "month";
    const locationId = toObjectId(req.query.locationId);
    const locFilter = locationId ? { locationId: locationId } : {};

    const { start, prevStart, prevEnd } = getPeriodRange(period);

    // ============ 1. DOANH THU THỰC THU (kỳ này vs kỳ trước) ============
    const thisPaidSum = await sumBetween(
      UserPackage, "total_price", "payment_date", start, new Date(),
      { ...locFilter, payment_status: "đã thanh toán" }, "createdAt"
    );
    const prevPaidSum = await sumBetween(
      UserPackage, "total_price", "payment_date", prevStart, prevEnd,
      { ...locFilter, payment_status: "đã thanh toán" }, "createdAt"
    );

    const thisWalletSum = locationId ? 0 : await sumBetween(
      WalletTransaction, "amount", "createdAt", start, new Date(),
      { type: "topup", status: "completed" }
    );
    const prevWalletSum = locationId ? 0 : await sumBetween(
      WalletTransaction, "amount", "createdAt", prevStart, prevEnd,
      { type: "topup", status: "completed" }
    );

    // Tiền book lịch tập riêng HLV đã thanh toán
    const thisBookingSum = await sumBetween(
      Booking, "price", "createdAt", start, new Date(),
      { ...locFilter, paymentStatus: "paid", trainerId: { $ne: null } }
    );
    const prevBookingSum = await sumBetween(
      Booking, "price", "createdAt", prevStart, prevEnd,
      { ...locFilter, paymentStatus: "paid", trainerId: { $ne: null } }
    );

    // ============ 2. DOANH THU SẢN PHẨM (cũng là tiền mặt thực thu) ============
    const allProducts = await Product.find({ ...(locationId ? { location_id: locationId } : {}) });

    function calcProductRevenue(start, end) {
      let total = 0;
      allProducts.forEach(p => {
        (p.monthlySales || []).forEach(s => {
          const saleDate = new Date(s.year, s.month - 1, 1);
          if (saleDate >= start && saleDate <= end) {
            total += s.revenue || 0;
          }
        });
      });
      return total;
    }
    const productRevThis = calcProductRevenue(start, new Date());
    const productRevPrev = calcProductRevenue(prevStart, prevEnd);

    // DOANH THU THỰC THU = Gói tập + Ví + Book PT + Sản phẩm
    const realCashInThis = thisPaidSum + thisWalletSum + thisBookingSum + productRevThis;
    const realCashInPrev = prevPaidSum + prevWalletSum + prevBookingSum + productRevPrev;

    // ============ 3. DOANH THU GHI NHẬN (kỳ này vs kỳ trước) ============

    // 2b. Doanh thu gói tập phân bổ theo thời hạn (chỉ gói đã thanh toán)
    function calcPackageRevenue(start, end) {
      let total = 0;
      return UserPackage.find({
        ...locFilter,
        payment_status: "đã thanh toán",
        start_date: { $lte: end },
        end_date: { $gte: start }
      }).then(pkgs => {
        pkgs.forEach(up => {
          const duration = up.duration_months || 1;
          const monthlyRev = (up.total_price || 0) / duration;

          // Số tháng giao nhau giữa gói và kỳ
          const pkgStart = new Date(up.start_date);
          const pkgEnd = new Date(up.end_date);
          const overlapStart = pkgStart > start ? pkgStart : start;
          const overlapEnd = pkgEnd < end ? pkgEnd : end;

          const months = (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12
            + (overlapEnd.getMonth() - overlapStart.getMonth()) + 1;
          total += monthlyRev * Math.max(0, months);
        });
        return total;
      });
    }
    const packageRevThis = await calcPackageRevenue(start, new Date());
    const packageRevPrev = await calcPackageRevenue(prevStart, prevEnd);

    const accrualThis = productRevThis + packageRevThis;
    const accrualPrev = productRevPrev + packageRevPrev;

    // ============ 3. TỔNG CHI PHÍ (kỳ này vs kỳ trước) ============
    const expenseFilter = locationId ? { locationId } : {};
    const expenseThis = await sumBetween(
      Expense, "amount", "date", start, new Date(), expenseFilter
    );
    const expensePrev = await sumBetween(
      Expense, "amount", "date", prevStart, prevEnd, expenseFilter
    );

    // ============ 3b. COGS (Giá vốn hàng bán) & TIỀN NHẬP HÀNG ============
    const productFilter = locationId ? { location_id: locationId } : {};
    const products = await Product.find(productFilter);

    // COGS = costPrice × số lượng đã bán trong kỳ (dựa trên monthlySales)
    let cogsThis = 0;
    let cogsPrev = 0;
    products.forEach(p => {
      const soldThis = (p.monthlySales || [])
        .filter(s => {
          const saleDate = new Date(s.year, s.month - 1, 1);
          return saleDate >= start && saleDate <= new Date();
        })
        .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
      cogsThis += (p.costPrice || 0) * soldThis;

      const soldPrev = (p.monthlySales || [])
        .filter(s => {
          const saleDate = new Date(s.year, s.month - 1, 1);
          return saleDate >= prevStart && saleDate <= prevEnd;
        })
        .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
      cogsPrev += (p.costPrice || 0) * soldPrev;
    });

    // ============ 3c. KHẤU HAO THIẾT BỊ (Nguyên giá / depreciationMonths) ============
    const equipmentFilter = locationId ? { location_id: locationId } : {};
    const equipments = await Equipment.find(equipmentFilter);
    const now = new Date();

    // Tính khấu hao cho 1 thiết bị trong khoảng [periodStart, periodEnd]
    function calcDepreciation(eq, periodStart, periodEnd) {
      const total = eq.total || 0;
      if (total <= 0) return 0;
      const depMonths = eq.depreciationMonths || 60;
      const monthlyDepr = total / depMonths;
      const eqStart = new Date(eq.createdAt);
      // Số tháng thiết bị tồn tại đến hết kỳ
      const monthsToEnd = (periodEnd.getFullYear() - eqStart.getFullYear()) * 12
        + (periodEnd.getMonth() - eqStart.getMonth()) + 1;
      if (monthsToEnd <= 0) return 0;
      // Số tháng bắt đầu từ kỳ này
      const monthsToStart = (periodStart.getFullYear() - eqStart.getFullYear()) * 12
        + (periodStart.getMonth() - eqStart.getMonth());
      const activeMonths = Math.max(0, monthsToEnd - Math.max(0, monthsToStart));
      const totalDepreciated = monthlyDepr * Math.min(activeMonths, depMonths);
      return Math.min(totalDepreciated, total);
    }

    // Khấu hao kỳ này
    const equipmentCostThis = equipments.reduce((sum, e) => sum + calcDepreciation(e, start, now), 0);

    // Khấu hao kỳ trước
    const equipmentCostPrev = equipments.reduce((sum, e) => sum + calcDepreciation(e, prevStart, prevEnd), 0);

    // Tổng COGS năm (dùng cho expenseStructure pie chart)
    const yearStartForCogs = new Date(now.getFullYear(), 0, 1);
    const totalCogsYear = products.reduce((sum, p) => {
      const soldInYear = (p.monthlySales || [])
        .filter(s => {
          const saleDate = new Date(s.year, s.month - 1, 1);
          return saleDate >= yearStartForCogs && saleDate <= now;
        })
        .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
      return sum + (p.costPrice || 0) * soldInYear;
    }, 0);

    // Khấu hao năm (dùng cho expenseStructure pie chart)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const totalEquipmentCost = equipments.reduce((sum, e) => sum + calcDepreciation(e, yearStart, now), 0);

    // Khấu hao theo tháng trong năm
    const equipmentSeries = MONTHS.map((_, i) => {
      const mStart = new Date(now.getFullYear(), i, 1);
      const isCurrentMonth = (i === now.getMonth());
      const mEnd = isCurrentMonth ? now : new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999);
      const value = equipments.reduce((sum, e) => {
        const total = e.total || 0;
        if (total <= 0) return sum;
        const depMonths = e.depreciationMonths || 60;
        const monthlyDepr = total / depMonths;
        const eqStart = new Date(e.createdAt);
        // Kiểm tra thiết bị có hoạt động trong tháng này không
        if (eqStart > mEnd) return sum;
        const monthsFromStart = (mEnd.getFullYear() - eqStart.getFullYear()) * 12
          + (mEnd.getMonth() - eqStart.getMonth()) + 1;
        if (monthsFromStart <= 0) return sum;
        const totalDepreciatedSoFar = monthlyDepr * Math.min(monthsFromStart, depMonths);
        if (totalDepreciatedSoFar > total) return sum;
        return sum + monthlyDepr;
      }, 0);
      return { month: MONTHS[i], value: Math.round(value) };
    });

    // Chi tiết khấu hao từng thiết bị (dùng cho Excel export)
    const depreciationDetail = equipments.filter(e => (e.total || 0) > 0).map(e => {
      const total = e.total || 0;
      const depMonths = e.depreciationMonths || 60;
      const monthlyDepr = total / depMonths;
      const eqStart = new Date(e.createdAt);
      const monthsActive = Math.min(
        depMonths,
        Math.max(0, (now.getFullYear() - eqStart.getFullYear()) * 12 + (now.getMonth() - eqStart.getMonth()) + 1)
      );
      const totalDepreciated = Math.min(monthlyDepr * monthsActive, total);
      return {
        name: e.name,
        total,
        monthlyDepreciation: Math.round(monthlyDepr),
        monthsActive,
        totalDepreciated: Math.round(totalDepreciated),
        remainingValue: Math.round(total - totalDepreciated),
      };
    });

    // COGS theo tháng (costPrice × SL bán trong tháng)
    const importSeries = MONTHS.map((label, idx) => {
      const mStart = new Date(now.getFullYear(), idx, 1);
      const isCurrentMonth = (idx === now.getMonth());
      const mEnd = isCurrentMonth ? now : new Date(now.getFullYear(), idx + 1, 0, 23, 59, 59, 999);
      const value = products.reduce((sum, p) => {
        const soldInMonth = (p.monthlySales || [])
          .filter(s => {
            const saleDate = new Date(s.year, s.month - 1, 1);
            return saleDate >= mStart && saleDate <= mEnd;
          })
          .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
        return sum + (p.costPrice || 0) * soldInMonth;
      }, 0);
      return { month: label, value };
    });

    // ============ 4. LỢI NHUẬN ============
    const totalExpenseThis = Math.round(expenseThis + cogsThis + equipmentCostThis);
    const totalExpensePrev = Math.round(expensePrev + cogsPrev + equipmentCostPrev);
    const profitThis = accrualThis - totalExpenseThis;
    const profitPrev = accrualPrev - totalExpensePrev;

    // ============ 4b. DÒNG TIỀN RÒNG (tích lũy từ đầu đến nay - không phụ thuộc kỳ) ============
    // Tổng tiền thu từ đầu đến giờ (theo CLB nếu chọn)
    const allTimeCashIn = await UserPackage.aggregate([
      { $match: { ...locFilter, payment_status: "đã thanh toán" } },
      { $group: { _id: null, total: { $sum: "$total_price" } } },
    ]);
    const allTimeCashInVal = (allTimeCashIn[0]?.total || 0);

    const allTimeWalletIn = await WalletTransaction.aggregate([
      { $match: { type: "topup", status: "completed", ...(locFilter.locationId ? { locationId: locFilter.locationId } : {}) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const allTimeWalletInVal = (allTimeWalletIn[0]?.total || 0);

    const allTimeBookingIn = await Booking.aggregate([
      { $match: { ...locFilter, paymentStatus: "paid", trainerId: { $ne: null } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const allTimeBookingInVal = (allTimeBookingIn[0]?.total || 0);

    const totalCashInAllTime = allTimeCashInVal + allTimeWalletInVal + allTimeBookingInVal;

    // Tổng chi phí cố định từ đầu đến giờ (theo CLB nếu chọn)
    const totalExpenseAllTime = await Expense.aggregate([
      { $match: locFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenseAllTimeVal = (totalExpenseAllTime[0]?.total || 0);

    // Tổng tiền nhập hàng từ đầu đến giờ (theo CLB nếu chọn - products đã filter sẵn)
    const totalImportAllTime = products.reduce((sum, p) => {
      return sum + (p.costPrice || 0) * (p.importQuantity || p.quantity || 0);
    }, 0);

    const netCashFlow = totalCashInAllTime - totalExpenseAllTimeVal - totalImportAllTime;

    const summary = {
      realCashIn: realCashInThis,
      accrualRevenue: accrualThis,
      totalExpense: totalExpenseThis,
      totalProfit: profitThis,
      importCost: cogsThis,
      netCashFlow,
      profitMargin: accrualThis ? Math.round((profitThis / accrualThis) * 100) : 0,
      change: {
        realCashIn: pctChange(realCashInThis, realCashInPrev),
        accrualRevenue: pctChange(accrualThis, accrualPrev),
        totalExpense: pctChange(totalExpenseThis, totalExpensePrev),
        totalProfit: pctChange(profitThis, profitPrev),
      },
    };

    // ============ SERIES THEO THÁNG ============
    const cashSeries = await monthlySeries(
      UserPackage, "total_price", "payment_date",
      { ...locFilter, payment_status: "đã thanh toán" }, "createdAt"
    );

    // Thêm tiền nạp ví theo tháng vào cashSeries (chỉ khi không lọc theo location)
    if (!locationId) {
      const walletByMonth = await WalletTransaction.aggregate([
        { $match: { type: "topup", status: "completed", createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
        { $project: { month: { $month: "$createdAt" }, amount: "$amount" } },
        { $group: { _id: "$month", value: { $sum: "$amount" } } },
      ]);
      walletByMonth.forEach(w => {
        const idx = w._id - 1;
        if (idx >= 0 && idx < 12) {
          cashSeries[idx].value += w.value;
        }
      });
    }

    // Thêm tiền book lịch tập riêng HLV theo tháng vào cashSeries
    const bookingByMonth = await Booking.aggregate([
      { $match: { ...locFilter, paymentStatus: "paid", trainerId: { $ne: null }, createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
      { $project: { month: { $month: "$createdAt" }, amount: "$price" } },
      { $group: { _id: "$month", value: { $sum: "$amount" } } },
    ]);
    bookingByMonth.forEach(b => {
      const idx = b._id - 1;
      if (idx >= 0 && idx < 12) {
        cashSeries[idx].value += b.value;
      }
    });

    // Doanh thu ghi nhận theo tháng
    const accrualByMonth = await UserPackage.find({
      ...locFilter,
      payment_status: "đã thanh toán",
      start_date: { $lte: now },
      end_date: { $gte: yearStart }
    });
    const accrualMonthly = MONTHS.map((_, i) => {
      const month = i + 1;
      let total = 0;
      // Sản phẩm bán trong tháng
      allProducts.forEach(p => {
        (p.monthlySales || []).forEach(s => {
          if (s.month === month && s.year === now.getFullYear()) {
            total += s.revenue || 0;
          }
        });
      });
      // Gói tập phân bổ trong tháng
      accrualByMonth.forEach(up => {
        const duration = up.duration_months || 1;
        const monthlyRev = (up.total_price || 0) / duration;
        const monthStart = new Date(now.getFullYear(), month - 1, 1);
        const monthEnd = new Date(now.getFullYear(), month, 0, 23, 59, 59, 999);
        const pkgStart = new Date(up.start_date);
        const pkgEnd = new Date(up.end_date);
        if (pkgStart <= monthEnd && pkgEnd >= monthStart) {
          total += monthlyRev;
        }
      });
      return { month: MONTHS[i], value: total };
    });

    // ============ CHI PHÍ & LÃI ============
    const expenseSeries = await monthlySeries(
      Expense, "amount", "date", expenseFilter
    );

    const cashFlowData = MONTHS.map((m, i) => {
      const rev = accrualMonthly[i].value;
      const exp = expenseSeries[i].value + importSeries[i].value + equipmentSeries[i].value;
      return {
        month: m,
        cash: cashSeries[i].value,
        revenue: rev,
        expense: exp,
        profit: rev - exp,
      };
    });

    const profitData = MONTHS.map((m, i) => {
      const rev = accrualMonthly[i].value;
      const exp = expenseSeries[i].value + importSeries[i].value + equipmentSeries[i].value;
      return { month: m, revenue: rev, expense: exp, profit: rev - exp };
    });

    // Cơ cấu chi phí
    const expenseByCategory = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: "$category", value: { $sum: "$amount" } } },
    ]);
    const categoryLabel = {
      equipment: "Sửa thiết bị",
      utilities: "Điện, nước, internet",
      tax: "Thuế/Phí",
      other: "Khác",
    };
    const expenseStructure = expenseByCategory.map((e) => ({
      name: categoryLabel[e._id] || e._id,
      value: e.value,
    }));
    if (cogsThis > 0) {
      expenseStructure.push({ name: "Giá vốn hàng bán (COGS)", value: Math.round(cogsThis) });
    }
    if (equipmentCostThis > 0) {
      expenseStructure.push({ name: "Tiền thiết bị", value: Math.round(equipmentCostThis) });
    }

    // ============ DOANH SỐ THEO GÓI & TỈ LỆ THAM GIA ============
    const packages = await Package.find({ is_active: true });
    const pkgMap = {};
    packages.forEach((p) => (pkgMap[p._id.toString()] = p));

    const allPackages = await UserPackage.find(locFilter)
      .populate("package_id", "name price duration_months")
      .populate("customer_id", "fullName account gender phone");

    const salesByPackage = {};
    allPackages.forEach((up) => {
      const key = up.package_id?._id?.toString() || up.package_id?.toString();
      if (!key) return;
      if (!salesByPackage[key]) {
        const pkg = pkgMap[key];
        salesByPackage[key] = {
          name: pkg?.name || "Gói không xác định",
          sales: 0,
          revenue: 0,
        };
      }
      salesByPackage[key].sales += 1;
      salesByPackage[key].revenue += up.total_price || 0;
    });

    const participation = await Promise.all(
      Object.keys(salesByPackage).map(async (key) => {
        const ups = allPackages.filter(
          (u) => (u.package_id?._id?.toString() || u.package_id?.toString()) === key
        );
        const ids = ups.map((u) => u._id);
        const checkins = await CheckIn.countDocuments({ userPackageId: { $in: ids } });
        const avgSessions = ups.length ? checkins / ups.length : 0;
        return {
          package: salesByPackage[key].name,
          sales: salesByPackage[key].sales,
          revenue: salesByPackage[key].revenue,
          participation: Number(avgSessions.toFixed(1)),
        };
      })
    );

    // ============ TOP SẢN PHẨM ============
    const productSales = allProducts.map((p) => ({
      name: p.name,
      price: p.price,
      costPrice: p.costPrice || 0,
      quantity: p.sold || 0,
      revenue: (p.price || 0) * (p.sold || 0),
      profit: ((p.price || 0) - (p.costPrice || 0)) * (p.sold || 0),
    }));
    const topProducts = productSales
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // ============ DOANH THU CHI TIẾT ============
    const revenueDetails = [];

    // 1. Đăng ký gói tập
    const paidPackages = await UserPackage.find({
      ...locFilter,
      payment_status: "đã thanh toán",
      $or: [
        { payment_date: { $gte: start, $lte: new Date() } },
        { $and: [{ $or: [{ payment_date: null }, { payment_date: { $exists: false } }] }, { createdAt: { $gte: start, $lte: new Date() } }] },
      ],
    }).populate("package_id", "name").populate("customer_id", "fullName account");
    paidPackages.forEach(up => {
      revenueDetails.push({
        date: up.payment_date || up.createdAt,
        type: "Đăng ký gói tập",
        name: up.package_id?.name || "Gói tập",
        customerName: up.customer_id?.fullName || up.customer_id?.account || "Khách hàng",
        amount: up.total_price || 0,
      });
    });

    // 2. Book lịch tập riêng HLV
    const paidBookings = await Booking.find({
      ...locFilter,
      paymentStatus: "paid",
      trainerId: { $ne: null },
      createdAt: { $gte: start, $lte: new Date() },
    }).populate("trainerId", "name").populate("customerId", "fullName account");
    paidBookings.forEach(b => {
      revenueDetails.push({
        date: b.createdAt,
        type: "Book lịch tập riêng HLV",
        name: `PT: ${b.trainerId?.name || 'HLV'}`,
        customerName: b.customerId?.fullName || b.customerId?.account || "Khách hàng",
        amount: b.price || 0,
      });
    });

    // 3. Mua sản phẩm shop
    allProducts.forEach(p => {
      (p.monthlySales || []).forEach(s => {
        const saleDate = new Date(s.year, s.month - 1, 1);
        if (saleDate >= start && saleDate <= new Date()) {
          revenueDetails.push({
            date: saleDate,
            type: "Mua sản phẩm shop",
            name: p.name,
            customerName: "Khách hàng",
            amount: s.revenue || 0,
          });
        }
      });
    });

    // 4. Tiền nạp ví
    const topupTransactions = await WalletTransaction.find({
      ...locFilter,
      type: "topup",
      status: "completed",
      createdAt: { $gte: start, $lte: new Date() },
    }).populate("customerId", "fullName account");
    topupTransactions.forEach(t => {
      revenueDetails.push({
        date: t.createdAt,
        type: "Nạp tiền vào ví",
        name: `Nạp ${Number(t.amount || 0).toLocaleString('vi-VN')}đ`,
        customerName: t.customerId?.fullName || t.customerId?.account || "Khách hàng",
        amount: t.amount || 0,
      });
    });

    // Sắp xếp theo ngày mới nhất
    revenueDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ============ CHI TIẾT CHI PHÍ ============
    const rawExpenseDetails = await Expense.find({
      ...expenseFilter,
      date: { $gte: start, $lte: new Date() },
    }).select('name category amount date note').sort({ date: -1 });

    // Chi tiết COGS theo từng sản phẩm
    const cogsDetails = [];
    products.forEach(p => {
      const soldInPeriod = (p.monthlySales || [])
        .filter(s => {
          const saleDate = new Date(s.year, s.month - 1, 1);
          return saleDate >= start && saleDate <= now;
        })
        .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
      if (soldInPeriod > 0 && (p.costPrice || 0) > 0) {
          cogsDetails.push({
            date: new Date(), name: `Nhập hàng: ${p.name}`, category: 'Giá vốn hàng bán (COGS)',
            amount: Math.round((p.costPrice || 0) * soldInPeriod), note: `${soldInPeriod} × ${(p.costPrice || 0).toLocaleString('vi-VN')}đ`, type: 'cogs'
          });
      }
    });

    // Chi tiết khấu hao theo từng thiết bị
    const depreciationDetails = [];
    equipments.forEach(eq => {
      const depr = calcDepreciation(eq, start, now);
      if (depr > 0) {
          depreciationDetails.push({
            date: eq.createdAt, name: `Khấu hao: ${eq.name}`, category: 'Tiền thiết bị',
            amount: Math.round(depr), note: `Nguyên giá ${(eq.total || 0).toLocaleString('vi-VN')}đ / ${eq.depreciationMonths || 60} tháng`, type: 'depreciation'
          });
      }
    });

    const expenseDetails = [
      ...rawExpenseDetails.map(e => ({
        date: e.date, name: e.name, category: categoryLabel[e.category] || e.category || 'Khác', amount: e.amount, note: e.note || '', type: 'expense'
      })),
      ...cogsDetails,
      ...depreciationDetails,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ============ CHI TIẾT GHI NHẬN THEO GÓI ============
    const activePackages = await UserPackage.find({
      ...locFilter,
      payment_status: "đã thanh toán",
      start_date: { $lte: now },
      end_date: { $gte: start },
    }).populate("package_id", "name").populate("customer_id", "fullName account");

    const accrualDetails = activePackages.map(up => {
      const duration = up.duration_months || 1;
      const monthlyRev = (up.total_price || 0) / duration;
      const pkgStart = new Date(up.start_date);
      const pkgEnd = new Date(up.end_date);
      const overlapStart = pkgStart > start ? pkgStart : start;
      const overlapEnd = pkgEnd < now ? pkgEnd : now;
      const monthsElapsed = Math.min(
        duration,
        Math.max(1, (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 + (overlapEnd.getMonth() - overlapStart.getMonth()) + 1)
      );
      return {
        packageName: up.package_id?.name || 'Gói không xác định',
        customerName: up.customer_id?.fullName || up.customer_id?.account || 'Khách hàng',
        totalPrice: up.total_price || 0,
        duration,
        monthlyRevenue: Math.round(monthlyRev),
        monthsElapsed,
        accrualAmount: Math.round(monthlyRev * monthsElapsed),
        startDate: up.start_date,
        endDate: up.end_date,
      };
    });

    // Thêm doanh thu sản phẩm vào accrualDetails
    allProducts.forEach(p => {
      (p.monthlySales || []).forEach(s => {
        const saleDate = new Date(s.year, s.month - 1, 1);
        if (saleDate >= start && saleDate <= now) {
          accrualDetails.push({
            packageName: `Sản phẩm: ${p.name}`,
            customerName: 'Khách hàng mua lẻ',
            totalPrice: s.revenue || 0,
            duration: 1,
            monthlyRevenue: s.revenue || 0,
            monthsElapsed: 1,
            accrualAmount: s.revenue || 0,
            startDate: saleDate,
            endDate: saleDate,
          });
        }
      });
    });

    return res.status(200).json({
      summary,
      cashFlowData,
      profitData,
      expenseStructure,
      participation,
      topProducts,
      depreciationDetail,
      revenueDetails,
      expenseDetails,
      accrualDetails,
      packageDetails: allPackages.map(up => ({
        packageName: up.package_id?.name || 'Gói không xác định',
        customerName: up.customer_id?.fullName || up.customer_id?.account || 'Khách hàng',
        gender: up.customer_id?.gender || '',
        phone: up.customer_id?.phone || '',
        totalPrice: up.total_price || 0,
        startDate: up.start_date,
        endDate: up.end_date,
        duration: up.duration_months || up.package_id?.duration_months || 1,
        paymentDate: up.payment_date || up.createdAt,
      })),

      // ============ 1. PHÂN TÍCH HỘI VIÊN ============
      ...await (async () => {
        const allPkgs = await UserPackage.find({
          ...(locationId ? { locationId } : {}),
          payment_status: 'đã thanh toán',
        }).populate('package_id', 'name title price');
        const allCustomers = await Customer.find(locationId ? { locationId } : {});

        // Hội viên active (có gói còn hiệu lực)
        const activeCustomerIds = new Set();
        allPkgs.forEach(up => {
          if (new Date(up.end_date) >= now) activeCustomerIds.add(up.customer_id?.toString());
        });
        const activeMembers = activeCustomerIds.size;

        // Tổng hội viên đã đăng ký
        const totalMembers = allCustomers.length;

        // Gói hết hạn trong kỳ này
        const expiredThisPeriod = allPkgs.filter(up => {
          const end = new Date(up.end_date);
          return end >= start && end <= now;
        });
        const expiredCount = expiredThisPeriod.length;

        // Trong số gói hết hạn, bao nhiêu gói có gói mới bắt đầu sau đó (giữ chân)
        const renewedCount = expiredThisPeriod.filter(up => {
          const customerId = up.customer_id?.toString();
          return allPkgs.some(other =>
            other.customer_id?.toString() === customerId &&
            other._id.toString() !== up._id.toString() &&
            new Date(other.start_date) > new Date(up.end_date) &&
            other.payment_status === 'đã thanh toán'
          );
        }).length;

        const retentionRate = expiredCount > 0 ? Math.round((renewedCount / expiredCount) * 100) : 100;
        const churnRate = 100 - retentionRate;

        // ARPU = DT thực thu / Số hội viên active
        const arpu = activeMembers > 0 ? Math.round(realCashInThis / activeMembers) : 0;

        // TB thời gian giữ chân (tháng)
        const lifetimes = allPkgs
          .filter(up => up.duration_months)
          .map(up => up.duration_months);
        const avgLifetime = lifetimes.length > 0
          ? +(lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length).toFixed(1)
          : 0;

        // Hội viên mới trong kỳ
        const newMembers = allCustomers.filter(c => {
          const reg = new Date(c.registerDate || c.createdAt);
          return reg >= start && reg <= now;
        }).length;

        // Check-in trong kỳ
        const checkinsThisPeriod = await CheckIn.countDocuments({
          ...(locationId ? { locationId } : {}),
          checkInTime: { $gte: start, $lte: now },
        });

        // === Danh sách chi tiết cho drill-down ===
        const customerMap = {};
        allCustomers.forEach(c => { customerMap[c._id.toString()] = c; });

        // 1. Hội viên active
        const activeList = [];
        const activeSeen = new Set();
        allPkgs.forEach(up => {
          if (new Date(up.end_date) >= now) {
            const cid = up.customer_id?.toString();
            if (cid && !activeSeen.has(cid)) {
              activeSeen.add(cid);
              const cust = customerMap[cid];
              activeList.push({
                name: cust?.fullName || 'N/A',
                phone: cust?.phone || '',
                package: up.package_id?.name || up.package_id?.title || 'N/A',
                startDate: up.start_date,
                endDate: up.end_date,
                totalPrice: up.total_price,
              });
            }
          }
        });

        // 2. Hội viên rời bỏ (gói hết hạn không gia hạn)
        const churnedList = expiredThisPeriod.filter(up => {
          const cid = up.customer_id?.toString();
          return !allPkgs.some(other =>
            other.customer_id?.toString() === cid &&
            other._id.toString() !== up._id.toString() &&
            new Date(other.start_date) > new Date(up.end_date) &&
            other.payment_status === 'đã thanh toán'
          );
        }).map(up => {
          const cust = customerMap[up.customer_id?.toString()];
          return {
            name: cust?.fullName || 'N/A',
            phone: cust?.phone || '',
            package: up.package_id?.name || up.package_id?.title || 'N/A',
            endDate: up.end_date,
            totalPrice: up.total_price,
          };
        });

        // 3. Hội viên giữ chân (gói hết hạn nhưng có gia hạn)
        const retainedList = expiredThisPeriod.filter(up => {
          const cid = up.customer_id?.toString();
          return allPkgs.some(other =>
            other.customer_id?.toString() === cid &&
            other._id.toString() !== up._id.toString() &&
            new Date(other.start_date) > new Date(up.end_date) &&
            other.payment_status === 'đã thanh toán'
          );
        }).map(up => {
          const cust = customerMap[up.customer_id?.toString()];
          return {
            name: cust?.fullName || 'N/A',
            phone: cust?.phone || '',
            package: up.package_id?.name || up.package_id?.title || 'N/A',
            endDate: up.end_date,
            totalPrice: up.total_price,
          };
        });

        // 4. Hội viên mới
        const newList = allCustomers.filter(c => {
          const reg = new Date(c.registerDate || c.createdAt);
          return reg >= start && reg <= now;
        }).map(c => ({
          name: c.fullName || 'N/A',
          phone: c.phone || '',
          registerDate: c.registerDate || c.createdAt,
          gender: c.gender || '',
        }));

        return {
          memberAnalytics: {
            activeMembers,
            totalMembers,
            newMembers,
            retentionRate,
            churnRate,
            arpu,
            avgLifetime,
            expiredPackages: expiredCount,
            renewedPackages: renewedCount,
            checkinsThisPeriod,
            activeList,
            churnedList,
            retainedList,
            newList,
          },
        };
      })(),

      // ============ 2. HIỆU SUẤT HLV ============
      ...await (async () => {
        const bookings = await Booking.find({
          ...(locationId ? { locationId } : {}),
          status: { $in: ['confirmed'] },
          trainerId: { $ne: null },
        }).populate('trainerId', 'fullName rating totalReviews pricePerSession locationId commissionPT')
          .populate('customerId', 'fullName');

        const trainerMap = {};
        bookings.forEach(b => {
          const tid = b.trainerId?._id?.toString() || b.trainerId?.toString() || 'unknown';
          if (!tid || tid === 'unknown') return;
          const trainerName = b.trainerId?.fullName || `HLV #${tid.slice(-4)}`;
          const price = b.price || 500000;
          if (!trainerMap[tid]) {
            trainerMap[tid] = {
              name: trainerName,
              rating: b.trainerId?.rating || 0,
              totalReviews: b.trainerId?.totalReviews || 0,
              pricePerSession: b.trainerId?.pricePerSession || price,
              commissionPT: b.trainerId?.commissionPT || 0,
              revenue: 0,
              sessions: 0,
              customers: new Set(),
            };
          }
          trainerMap[tid].revenue += price;
          trainerMap[tid].sessions += 1;
          trainerMap[tid].customers.add(b.customerId?._id?.toString() || b.customerId?.toString());
        });

        const trainerPerformance = Object.values(trainerMap)
          .map(t => ({
            name: t.name,
            revenue: t.revenue,
            sessions: t.sessions,
            uniqueCustomers: t.customers.size,
            rating: t.rating,
            totalReviews: t.totalReviews,
            estimatedCommission: Math.round(t.revenue * (t.commissionPT / 100)),
          }))
          .sort((a, b) => b.revenue - a.revenue);

        return { trainerPerformance };
      })(),

      // ============ 3. SO SÁNH CLB ============
      ...await (async () => {
        const locations = await Location.find({});
        if (locations.length <= 1) return { clubComparison: [] };

        const clubComparison = await Promise.all(locations.map(async (loc) => {
          const lid = loc._id.toString();
          const locFilter = { locationId: loc._id };

          // DT thực thu theo CLB
          const clubPaidSum = await UserPackage.aggregate([
            { $match: { ...locFilter, payment_status: 'đã thanh toán', payment_date: { $gte: start, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$total_price' } } },
          ]);
          const clubBookingSum = await Booking.aggregate([
            { $match: { ...locFilter, status: 'confirmed', trainerId: { $ne: null }, createdAt: { $gte: start, $lte: now } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 500000] } } } },
          ]);
          const clubProducts = await Product.find({ location_id: loc._id });
          const clubProductSum = clubProducts.reduce((sum, p) => {
            const sold = (p.monthlySales || []).filter(s => {
              const d = new Date(s.year, s.month - 1, 1);
              return d >= start && d <= now;
            }).reduce((m, s) => m + (s.revenue || 0), 0);
            return sum + sold;
          }, 0);
          const revenue = (clubPaidSum[0]?.total || 0) + (clubBookingSum[0]?.total || 0) + clubProductSum;

          // Chi phí cố định theo CLB
          const clubExpense = await Expense.aggregate([
            { $match: { ...locFilter, date: { $gte: start, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          const fixedCost = clubExpense[0]?.total || 0;

          // COGS theo CLB = costPrice × SL bán
          const clubCogs = clubProducts.reduce((sum, p) => {
            const soldInPeriod = (p.monthlySales || []).filter(s => {
              const d = new Date(s.year, s.month - 1, 1);
              return d >= start && d <= now;
            }).reduce((m, s) => m + (s.quantity || 0), 0);
            return sum + (p.costPrice || 0) * soldInPeriod;
          }, 0);

          // Khấu hao theo CLB
          const clubEquipments = await Equipment.find({ location_id: loc._id });
          const clubDepreciation = clubEquipments.reduce((sum, eq) => {
            const total = eq.total || 0;
            if (total <= 0) return sum;
            const depMonths = eq.depreciationMonths || 60;
            const monthlyDepr = total / depMonths;
            const eqStart = new Date(eq.createdAt);
            if (eqStart > now) return sum;
            const monthsFromStart = Math.min(depMonths, Math.max(1, (now.getFullYear() - eqStart.getFullYear()) * 12 + (now.getMonth() - eqStart.getMonth()) + 1));
            const totalDep = Math.min(monthlyDepr * monthsFromStart, total);
            // Phân bổ theo kỳ
            const overlapStart = eqStart > start ? eqStart : start;
            const overlapEnd = now;
            const monthsInPeriod = Math.max(1, (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 + (overlapEnd.getMonth() - overlapStart.getMonth()) + 1);
            return sum + Math.round(monthlyDepr * Math.min(monthsInPeriod, 1));
          }, 0);

          const expense = fixedCost + Math.round(clubCogs) + clubDepreciation;
          const profit = revenue - expense;
          const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

          // Số hội viên active
          const memberCount = await UserPackage.countDocuments({
            ...locFilter,
            payment_status: 'đã thanh toán',
            end_date: { $gte: now },
          });

          // Số HLV active
          const trainerCount = await Staff.countDocuments({
            locationId: loc._id,
            status: 'active',
          });

          return {
            name: loc.title || loc.address || 'CLB',
            revenue,
            expense,
            profit,
            margin,
            memberCount,
            trainerCount,
          };
        }));

        return { clubComparison };
      })(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getOperationsStatistics = async (req, res) => {
  try {
    const locationId = toObjectId(req.query.locationId);
    const match = locationId ? { location_id: locationId } : {};

    const equipments = await Equipment.find(match);

    const statusMap = {};
    const reportsByType = {};
    const reportDetails = [];
    let totalReports = 0;
    let pendingReports = 0;

    equipments.forEach((eq) => {
      const totalQty = eq.quantity || 1;
      const eqPendingReports = (eq.reports || []).filter(r => r.status === "pending");

      if (eqPendingReports.length > 0) {
        // Tổng số máy bị ảnh hưởng từ tất cả báo cáo pending
        let pendingAffected = 0;
        eqPendingReports.forEach(r => {
          pendingAffected += r.affectedQuantity || 1;
        });
        const affected = Math.min(pendingAffected, totalQty);

        // Lấy statusType từ report pending gần nhất để xác định loại sự cố
        const latestReport = eqPendingReports[eqPendingReports.length - 1];
        const reportStatusType = latestReport.statusType || "hoạt động";
        let affectedStatus = "maintenance";
        if (reportStatusType === "hỏng hóc" || reportStatusType === "thiếu linh kiện") affectedStatus = "broken";
        else if (reportStatusType === "bảo trì") affectedStatus = "maintenance";

        statusMap[affectedStatus] = (statusMap[affectedStatus] || 0) + affected;
        // Phần còn lại vẫn hoạt động
        if (totalQty > affected) {
          statusMap["active"] = (statusMap["active"] || 0) + (totalQty - affected);
        }
      } else {
        statusMap["active"] = (statusMap["active"] || 0) + totalQty;
      }

      (eq.reports || []).forEach((r) => {
        totalReports += 1;
        if (r.status === "pending") pendingReports += 1;
        const t = r.statusType || "other";
        reportsByType[t] = (reportsByType[t] || 0) + 1;
        reportDetails.push({
          equipmentName: eq.name,
          statusType: r.statusType || "other",
          affectedQuantity: r.affectedQuantity || 1,
          reason: r.reason,
          reportedAt: r.reportedAt,
          status: r.status,
        });
      });
    });

    const statusLabel = {
      active: "Hoạt động",
      maintenance: "Bảo trì",
      broken: "Hỏng",
      inactive: "Ngưng dùng",
    };
    const statusColors = {
      active: "#10b981",
      maintenance: "#f59e0b",
      broken: "#ef4444",
      inactive: "#94a3b8",
    };

    const equipmentStatus = Object.keys(statusMap).map((k) => ({
      name: statusLabel[k] || k,
      value: statusMap[k],
      color: statusColors[k] || "#94a3b8",
    }));

    const reportLabel = {
      "hoạt động": "Hoạt động",
      "bảo trì": "Bảo trì",
      "hỏng hóc": "Hỏng hóc",
      "thiếu linh kiện": "Thiếu linh kiện",
      other: "Khác",
    };
    const equipmentReports = Object.keys(reportsByType).map((k) => ({
      name: reportLabel[k] || k,
      value: reportsByType[k],
    }));

    const totalQuantity = equipments.reduce((s, e) => s + (e.quantity || 0), 0);
    const totalValue = equipments.reduce((s, e) => s + (e.total || 0), 0);

    const now = new Date();
    const needMaintenance = equipments
      .filter((e) => e.status === "maintenance" || (e.reports || []).some((r) => r.status === "pending"))
      .map((e) => {
        const pendingRpts = (e.reports || []).filter((r) => r.status === "pending");
        const affectedQty = pendingRpts.reduce((sum, r) => sum + (r.affectedQuantity || 1), 0);
        return {
          name: e.name,
          quantity: e.quantity || 1,
          affectedQuantity: Math.min(affectedQty, e.quantity || 1),
          status: e.status,
          reports: pendingRpts.length,
          warrantyLeft:
          e.warranty_period && e.createdAt
            ? Math.max(
                0,
                e.warranty_period -
                  Math.floor((now - new Date(e.createdAt)) / (1000 * 60 * 60 * 24 * 30))
              )
            : null,
        };
      })
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 8);

    return res.status(200).json({
      equipmentStatus,
      equipmentReports,
      reportDetails,
      totalQuantity,
      totalValue,
      totalReports,
      pendingReports,
      needMaintenance,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
