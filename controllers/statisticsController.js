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

    const thisWalletSum = locationId ? 0 : await sumBetween(
      WalletTransaction, "amount", "createdAt", start, new Date(),
      { type: "topup", status: "completed" }
    );
    const prevWalletSum = locationId ? 0 : await sumBetween(
      WalletTransaction, "amount", "createdAt", prevStart, prevEnd,
      { type: "topup", status: "completed" }
    );

    const realCashInThis = thisPaidSum + thisWalletSum;
    const realCashInPrev = prevPaidSum + prevWalletSum;

    // ============ 2. DOANH THU GHI NHẬN (kỳ này vs kỳ trước) ============
    // 2a. Doanh thu sản phẩm theo tháng = price × sold trong tháng
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

    // ============ 3b. COGS & TIỀN NHẬP HÀNG ============
    const productFilter = locationId ? { location_id: locationId } : {};
    const products = await Product.find(productFilter);

    let cogsThis = 0;
    if (period === "week") {
      // Tuần: COGS = costPrice × số lượng đã bán trong khoảng thời gian (dựa trên monthlySales)
      cogsThis = products.reduce((sum, p) => {
        const soldInPeriod = (p.monthlySales || [])
          .filter(s => {
            const saleDate = new Date(s.year, s.month - 1, 1);
            return saleDate >= start && saleDate <= new Date();
          })
          .reduce((mSum, s) => mSum + (s.quantity || 0), 0);
        return sum + (p.costPrice || 0) * soldInPeriod;
      }, 0);
    } else {
      // Tháng/quý/năm: tổng tiền nhập hàng (dựa trên importDate)
      cogsThis = products
        .filter(p => {
          const impDate = new Date(p.importDate);
          return impDate >= start && impDate <= new Date();
        })
        .reduce((sum, p) => sum + (p.costPrice || 0) * (p.importQuantity || p.quantity || 0), 0);
    }

    // Tổng tiền nhập hàng năm (dùng cho expenseStructure pie chart)
    const totalImportCost = products
      .filter(p => {
        const impDate = new Date(p.importDate);
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        return impDate >= yearStart && impDate <= new Date();
      })
      .reduce((sum, p) => sum + (p.costPrice || 0) * (p.importQuantity || p.quantity || 0), 0);

    // ============ 3c. KHẤU HAO THIẾT BỊ (Nguyên giá / 60 tháng = 5 năm) ============
    const DEPRECIATION_MONTHS = 60;
    const equipmentFilter = locationId ? { location_id: locationId } : {};
    const equipments = await Equipment.find(equipmentFilter);
    const now = new Date();

    // Tính khấu hao cho 1 thiết bị trong khoảng [periodStart, periodEnd]
    function calcDepreciation(eq, periodStart, periodEnd) {
      const total = eq.total || 0;
      if (total <= 0) return 0;
      const monthlyDepr = total / DEPRECIATION_MONTHS;
      const eqStart = new Date(eq.createdAt);
      // Số tháng thiết bị tồn tại đến hết kỳ
      const monthsToEnd = (periodEnd.getFullYear() - eqStart.getFullYear()) * 12
        + (periodEnd.getMonth() - eqStart.getMonth()) + 1;
      if (monthsToEnd <= 0) return 0;
      // Số tháng bắt đầu từ kỳ này
      const monthsToStart = (periodStart.getFullYear() - eqStart.getFullYear()) * 12
        + (periodStart.getMonth() - eqStart.getMonth());
      const activeMonths = Math.max(0, monthsToEnd - Math.max(0, monthsToStart));
      // Không vượt quá 60 tháng và không vượt quá nguyên giá
      const totalDepreciated = monthlyDepr * Math.min(activeMonths, DEPRECIATION_MONTHS);
      return Math.min(totalDepreciated, total);
    }

    // Khấu hao kỳ này
    const equipmentCostThis = equipments.reduce((sum, e) => sum + calcDepreciation(e, start, now), 0);

    // Khấu hao năm (dùng cho expenseStructure pie chart)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const totalEquipmentCost = equipments.reduce((sum, e) => sum + calcDepreciation(e, yearStart, now), 0);

    // Khấu hao theo tháng trong năm
    const equipmentSeries = MONTHS.map((_, i) => {
      const mStart = new Date(now.getFullYear(), i, 1);
      const mEnd = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999);
      const value = equipments.reduce((sum, e) => {
        const total = e.total || 0;
        if (total <= 0) return sum;
        const monthlyDepr = total / DEPRECIATION_MONTHS;
        const eqStart = new Date(e.createdAt);
        // Kiểm tra thiết bị có hoạt động trong tháng này không
        if (eqStart > mEnd) return sum;
        const monthsFromStart = (mEnd.getFullYear() - eqStart.getFullYear()) * 12
          + (mEnd.getMonth() - eqStart.getMonth()) + 1;
        if (monthsFromStart <= 0) return sum;
        // Đã khấu hao hết chưa?
        const totalDepreciatedSoFar = monthlyDepr * Math.min(monthsFromStart, DEPRECIATION_MONTHS);
        if (totalDepreciatedSoFar > total) return sum;
        return sum + monthlyDepr;
      }, 0);
      return { month: MONTHS[i], value: Math.round(value) };
    });

    // Chi tiết khấu hao từng thiết bị (dùng cho Excel export)
    const depreciationDetail = equipments.filter(e => (e.total || 0) > 0).map(e => {
      const total = e.total || 0;
      const monthlyDepr = total / DEPRECIATION_MONTHS;
      const eqStart = new Date(e.createdAt);
      const monthsActive = Math.min(
        DEPRECIATION_MONTHS,
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

    // Tiền nhập hàng theo tháng (dựa trên importDate)
    const importByMonth = await Product.aggregate([
      { $match: { ...productFilter, importDate: { $gte: new Date(now.getFullYear(), 0, 1) } } },
      { $project: { month: { $month: "$importDate" }, cost: { $multiply: ["$costPrice", "$importQuantity"] } } },
      { $group: { _id: "$month", value: { $sum: "$cost" } } },
    ]);
    const importSeries = MONTHS.map((label, idx) => {
      const found = importByMonth.find((r) => r._id === idx + 1);
      return { month: label, value: found ? found.value : 0 };
    });

    // ============ 4. LỢI NHUẬN ============
    const totalExpenseThis = expenseThis + cogsThis + equipmentCostThis;
    const totalExpensePrev = expensePrev; // kỳ trước không có import cost đã bán
    const profitThis = accrualThis - totalExpenseThis;
    const profitPrev = accrualPrev - totalExpensePrev;

    const summary = {
      realCashIn: realCashInThis,
      accrualRevenue: accrualThis,
      totalExpense: totalExpenseThis,
      totalProfit: profitThis,
      importCost: cogsThis,
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
    if (totalImportCost > 0) {
      expenseStructure.push({ name: "Tiền nhập hàng", value: totalImportCost });
    }
    if (totalEquipmentCost > 0) {
      expenseStructure.push({ name: "Tiền thiết bị", value: totalEquipmentCost });
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
      depreciationDetail,
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
