import PackagePriceHistory from '../models/schemas/packagePriceHistorySchema.js';

/**
 * Quy tắc giá tập trung:
 *  - Giá tháng gốc (unitPrice) + bảng giảm giá theo số tháng (durations [{months, discount%}]).
 *  - Hệ thống tự tính thành tiền, client KHÔNG được gõ giá tay ở từng mức.
 *
 * Công thức: totalPrice = unitPrice * months * (1 - discount/100), làm tròn đến nghìn.
 */

export const roundToThousand = (value) => Math.round(value / 1000) * 1000;

// Chuẩn hóa bảng durations đầu vào (loại bản ghi rác, ép kiểu, khử trùng lặp)
export const normalizeDurations = (durations = []) => {
  const map = new Map();
  for (const d of durations || []) {
    const months = Number(d?.months);
    const discount = Number(d?.discount) || 0;
    if (!months || months <= 0 || discount < 0 || discount > 100) continue;
    map.set(months, { months, discount });
  }
  return [...map.values()].sort((a, b) => a.months - b.months);
};

export const findTier = (durations, months) => {
  const list = normalizeDurations(durations);
  return (
    list.find((d) => d.months === Number(months)) ||
    list.find((d) => Number(months) % d.months === 0 && Number(months) >= d.months)
  );
};

/**
 * Tính giá cho `months` tháng của một gói.
 * Trả về { unit_price, months, discount_percent, total_price, has_tier_rule }
 */
export const computeTierPrice = (pkg, months) => {
  const unitPrice = Number(pkg?.unitPrice ?? pkg?.price ?? 0);
  const nMonths = Number(months);

  if (!unitPrice || unitPrice <= 0) {
    throw new Error('Gói tập chưa có đơn giá theo tháng, vui lòng cấu hình giá trước!');
  }
  if (!nMonths || nMonths <= 0) {
    throw new Error('Số tháng không hợp lệ!');
  }

  // Gói full tháng PT: giá vẫn tính theo unitPrice * tháng
  const tier = findTier(pkg?.durations, nMonths);

  if (!tier) {
    return {
      unit_price: unitPrice,
      months: nMonths,
      discount_percent: 0,
      total_price: roundToThousand(unitPrice * nMonths),
      has_tier_rule: false,
    };
  }

  return {
    unit_price: unitPrice,
    months: nMonths,
    discount_percent: tier.discount,
    total_price: roundToThousand(unitPrice * tier.months * (1 - tier.discount / 100)),
    has_tier_rule: true,
  };
};

/** Bảng giá đầy đủ của gói (để hiển thị + xuất PDF): từng mức tháng kèm giá tự tính */
export const buildPriceTable = (pkg) => {
  const unitPrice = Number(pkg?.unitPrice ?? pkg?.price ?? 0);
  const rows = normalizeDurations(pkg?.durations).map((tier) => ({
    months: tier.months,
    discount_percent: tier.discount,
    total_price: roundToThousand(unitPrice * tier.months * (1 - tier.discount / 100)),
  }));
  return {
    unit_price: unitPrice,
    rows,
  };
};

/** Ghi lịch sử giá khi tạo mới hoặc phát hiện thay đổi giá/bảng giảm giá */
export const recordPriceHistory = async ({ pkg, oldUnitPrice, oldDurations, staff, reason }) => {
  try {
    await PackagePriceHistory.create({
      package_id: pkg._id,
      unit_price: Number(pkg.unitPrice ?? pkg.price ?? 0),
      unit_price_old: oldUnitPrice ?? null,
      durations: normalizeDurations(pkg.durations),
      durations_old: oldDurations ? normalizeDurations(oldDurations) : null,
      reason: reason || '',
      changed_by: staff?.id || null,
      changed_by_name: staff?.fullName || staff?.username || '',
      changed_at: new Date(),
    });
  } catch (err) {
    console.error('[Pricing] Lỗi ghi lịch sử giá:', err.message);
  }
};

/** So sánh có thay đổi giá hay không */
export const isPriceChanged = (existing, incomingUnitPrice, incomingDurations) => {
  const oldPrice = Number(existing?.unitPrice ?? existing?.price ?? 0);
  const newPrice = Number(incomingUnitPrice ?? existing?.unitPrice ?? 0);
  if (oldPrice !== newPrice) return true;

  const norm = (list) =>
    JSON.stringify(normalizeDurations(list).map((d) => [d.months, d.discount]));
  return norm(existing?.durations) !== norm(incomingDurations ?? existing?.durations);
};
