import UserPackage from "../models/schemas/userPackageSchema.js";
import Expense from "../models/schemas/expenseSchema.js";
import WalletTransaction from "../models/schemas/walletTransactionSchema.js";
import Package from "../models/schemas/packageSchema.js";
import Product from "../models/schemas/productSchema.js";
import Equipment from "../models/schemas/equipmentSchema.js";
import CheckIn from "../models/schemas/checkInSchema.js";

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
async function monthlySeries(Model, amountField, dateField, matchExtra = {}) {
  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);
  const groupMatch = { [dateField]: { $gte: startYear }, ...matchExtra };

  const rows = await Model.aggregate([
    { $match: groupMatch },
    {
      $group: {
        _id: { $month: `$${dateField}` },
        value: { $sum: `$${amountField}` },
      },
    },
  ]);

  return MONTHS.map((label, idx) => {
    const found = rows.find((r) => r._id === idx + 1);
    return { month: label, value: found ? found.value : 0 };
  });
}

// Tổng theo khoảng thời gian
async function sumBetween(Model, amountField, dateField, start, end, matchExtra = {}) {
  const filter = {
    [dateField]: { $gte: start, $lte: end },
    ...matchExtra,
  };
  const result = await Model.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: `$${amountField}` } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
}

export const getFinanceStatistics = async (req, res) => {
  try {
    const period = req.query.period || "month";
    const locationId = req.query.locationId || null;
    const locFilter = locationId ? { locationId: locationId } : {};

    const { start, prevStart, prevEnd } = getPeriodRange(period);

    // ============ 1. DOANH THU THỰC THU (kỳ này vs kỳ trước) ============
    const thisPaidSum = await sumBetween(
      UserPackage, "total_price", "payment_date", start, new Date(),
      { ...locFilter, payment_status: "đã thanh toán" }
    );
    const prevPaidSum = await sumBetween(
      UserPackage, "total_price", "payment_date", prevStart, prevEnd,
      { ...locFilter, payment_status: "đã thanh toán" }
    );

    const thisWalletSum = await sumBetween(
      WalletTransaction, "amount", "createdAt", start, new Date(),
      { type: "topup", status: "completed" }
    );
    const prevWalletSum = await sumBetween(
      WalletTransaction, "amount", "createdAt", prevStart, prevEnd,
      { type: "topup", status: "completed" }
    );

    const realCashInThis = thisPaidSum + thisWalletSum;
    const realCashInPrev = prevPaidSum + prevWalletSum;

    // ============ 2. DOANH THU GHI NHẬN (kỳ này vs kỳ trước) ============
    const accrualThis = await sumBetween(
      UserPackage, "total_price", "createdAt", start, new Date(), locFilter
    );
    const accrualPrev = await sumBetween(
      UserPackage, "total_price", "createdAt", prevStart, prevEnd, locFilter
    );

    // ============ 3. TỔNG CHI PHÍ (kỳ này vs kỳ trước) ============
    const expenseFilter = locationId ? { locationId } : {};
    const expenseThis = await sumBetween(
      Expense, "amount", "date", start, new Date(), expenseFilter
    );
    const expensePrev = await sumBetween(
      Expense, "amount", "date", prevStart, prevEnd, expenseFilter
    );

    // ============ 3b. TIỀN NHẬP HÀNG (COGS - chỉ tính hàng đã bán) ============
    const productFilter = locationId ? { location_id: locationId } : {};
    const products = await Product.find(productFilter);
    const importCostThis = products.reduce((sum, p) => sum + (p.costPrice || 0) * (p.sold || 0), 0);

    // Tiền nhập hàng theo tháng (dựa trên importDate, chỉ tính phần đã bán)
    const importByMonth = await Product.aggregate([
      { $match: { ...productFilter, importDate: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
      { $project: { month: { $month: "$importDate" }, cost: { $multiply: ["$costPrice", "$sold"] } } },
      { $group: { _id: "$month", value: { $sum: "$cost" } } },
    ]);
    const importSeries = MONTHS.map((label, idx) => {
      const found = importByMonth.find((r) => r._id === idx + 1);
      return { month: label, value: found ? found.value : 0 };
    });

    // ============ 4. LỢI NHUẬN ============
    const totalExpenseThis = expenseThis + importCostThis;
    const totalExpensePrev = expensePrev; // kỳ trước không có import cost đã bán
    const profitThis = accrualThis - totalExpenseThis;
    const profitPrev = accrualPrev - totalExpensePrev;

    const summary = {
      realCashIn: realCashInThis,
      accrualRevenue: accrualThis,
      totalExpense: totalExpenseThis,
      totalProfit: profitThis,
      importCost: importCostThis,
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
      { ...locFilter, payment_status: "đã thanh toán" }
    );
    const accrualSeries = await monthlySeries(
      UserPackage, "total_price", "createdAt", locFilter
    );

    const cashFlowData = MONTHS.map((m, i) => ({
      month: m,
      cash: cashSeries[i].value,
      revenue: accrualSeries[i].value,
    }));

    // ============ CHI PHÍ & LÃI ============
    const expenseSeries = await monthlySeries(
      Expense, "amount", "date", expenseFilter
    );

    const profitData = MONTHS.map((m, i) => {
      const rev = accrualSeries[i].value;
      const exp = expenseSeries[i].value + importSeries[i].value;
      return { month: m, revenue: rev, expense: exp, profit: rev - exp };
    });

    // Cơ cấu chi phí
    const expenseByCategory = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: "$category", value: { $sum: "$amount" } } },
    ]);
    const categoryLabel = {
      equipment: "Thiết bị",
      utilities: "Tiện ích",
      tax: "Thuế/Phí",
      other: "Khác",
    };
    const expenseStructure = expenseByCategory.map((e) => ({
      name: categoryLabel[e._id] || e._id,
      value: e.value,
    }));
    if (importCostThis > 0) {
      expenseStructure.push({ name: "Tiền nhập hàng", value: importCostThis });
    }

    // ============ DOANH SỐ THEO GÓI & TỈ LỆ THAM GIA ============
    const packages = await Package.find({ is_active: true });
    const pkgMap = {};
    packages.forEach((p) => (pkgMap[p._id.toString()] = p));

    const allPackages = await UserPackage.find(locFilter).populate("package_id", "name price");

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
    const allProducts = await Product.find({ ...(locationId ? { location_id: locationId } : {}) });
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

    return res.status(200).json({
      summary,
      cashFlowData,
      profitData,
      expenseStructure,
      participation,
      topProducts,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getOperationsStatistics = async (req, res) => {
  try {
    const locationId = req.query.locationId || null;
    const match = locationId ? { location_id: locationId } : {};

    const equipments = await Equipment.find(match);

    const statusMap = {};
    const reportsByType = {};
    let totalReports = 0;
    let pendingReports = 0;

    equipments.forEach((eq) => {
      const st = eq.status || "active";
      statusMap[st] = (statusMap[st] || 0) + 1;
      (eq.reports || []).forEach((r) => {
        totalReports += 1;
        if (r.status === "pending") pendingReports += 1;
        const t = r.statusType || "other";
        reportsByType[t] = (reportsByType[t] || 0) + 1;
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
      .map((e) => ({
        name: e.name,
        status: e.status,
        reports: (e.reports || []).filter((r) => r.status === "pending").length,
        warrantyLeft:
          e.warranty_period && e.createdAt
            ? Math.max(
                0,
                e.warranty_period -
                  Math.floor((now - new Date(e.createdAt)) / (1000 * 60 * 60 * 24 * 30))
              )
            : null,
      }))
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 8);

    return res.status(200).json({
      equipmentStatus,
      equipmentReports,
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
