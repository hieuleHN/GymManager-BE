/**
 * Tự phân bổ buổi PT theo từng tháng khi khách mua / gia hạn gói.
 *  - Gói thường có ptSessionsPerMonth > 0: mỗi tháng được cấp `ptSessionsPerMonth` buổi.
 *  - Gói isFullMonth: không giới hạn (lưu total = 999 như quy ước hiện tại).
 *  - Gói thuần gym (0 buổi): trả mảng rỗng.
 */
export const allocatePtSessions = (startDate, durationMonths, pkg) => {
  const start = new Date(startDate);
  const months = Number(durationMonths) || 1;
  const isFullMonth = !!(pkg?.isFullMonth);
  const perMonth = Number(pkg?.ptSessionsPerMonth) || 0;
  const monthlySessions = [];

  if (!isFullMonth && perMonth <= 0) return monthlySessions;

  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    monthlySessions.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      total: isFullMonth ? 999 : perMonth,
      used: 0,
    });
  }
  return monthlySessions;
};

/** Ngày kết thúc từ ngày bắt đầu + số tháng */
export const addMonths = (startDate, months) => {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + (Number(months) || 0));
  return end;
};
