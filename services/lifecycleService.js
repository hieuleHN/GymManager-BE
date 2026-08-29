/**
 * Vòng đời gói tập: nháp -> đang bán -> tạm ngưng -> ngừng bán
 * Gói không ở trạng thái "đang bán" sẽ tự ẩn khỏi các trang phía khách.
 */
export const LIFECYCLE = {
  DRAFT: 'nháp',
  ACTIVE: 'đang bán',
  PAUSED: 'tạm ngưng',
  DISCONTINUED: 'ngừng bán',
};

// Bảng chuyển trạng thái hợp lệ
export const ALLOWED_TRANSITIONS = {
  [LIFECYCLE.DRAFT]: [LIFECYCLE.ACTIVE, LIFECYCLE.DISCONTINUED],
  [LIFECYCLE.ACTIVE]: [LIFECYCLE.PAUSED, LIFECYCLE.DISCONTINUED],
  [LIFECYCLE.PAUSED]: [LIFECYCLE.ACTIVE, LIFECYCLE.DISCONTINUED],
  // Ngừng bán là trạng thái chốt: chỉ cho phép mở bán lại khi thực sự cần (đã ghi audit)
  [LIFECYCLE.DISCONTINUED]: [LIFECYCLE.ACTIVE],
};

export const isValidStatus = (status) => Object.values(LIFECYCLE).includes(status);

export const canTransition = (from, to) => {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) || false;
};

/** Điều kiện lọc các gói hiển thị cho khách (kể cả dữ liệu cũ chưa có lifecycle_status) */
export const publicVisibilityFilter = () => ({
  $or: [
    { lifecycle_status: LIFECYCLE.ACTIVE },
    { lifecycle_status: { $exists: false }, is_active: true },
  ],
});

/** Nhãn tiếng Việt hiển thị */
export const statusLabel = (status) =>
  ({
    [LIFECYCLE.DRAFT]: 'Nháp',
    [LIFECYCLE.ACTIVE]: 'Đang bán',
    [LIFECYCLE.PAUSED]: 'Tạm ngưng',
    [LIFECYCLE.DISCONTINUED]: 'Ngừng bán',
  })[status] || status;
