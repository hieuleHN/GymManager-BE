import Package from '../models/schemas/packageSchema.js';

/**
 * Migration chạy một lần khi khởi động server (idempotent):
 *  - Dữ liệu cũ chưa có lifecycle_status:
 *      is_active = true  -> "đang bán"
 *      is_active = false -> "tạm ngưng"
 *  - Đồng bộ ngược: gói có lifecycle_status thì is_active phải khớp (chỉ đang bán là active).
 */
export const migratePackageLifecycleStatus = async () => {
  try {
    const r1 = await Package.updateMany(
      { lifecycle_status: { $exists: false }, is_active: { $ne: false } },
      {
        $set: {
          lifecycle_status: 'đang bán',
          is_active: true,
          status_changed_at: new Date(),
        },
      }
    );

    const r2 = await Package.updateMany(
      { lifecycle_status: { $exists: false }, is_active: false },
      {
        $set: {
          lifecycle_status: 'tạm ngưng',
          status_changed_at: new Date(),
        },
      }
    );

    const r3 = await Package.updateMany(
      { lifecycle_status: 'đang bán', is_active: { $ne: true } },
      { $set: { is_active: true } }
    );
    const r4 = await Package.updateMany(
      { lifecycle_status: { $in: ['nháp', 'tạm ngưng', 'ngừng bán'] }, is_active: true },
      { $set: { is_active: false } }
    );

    // Tự chữa dữ liệu kẹt do bug cũ: admin đã bấm "Kích hoạt" nhưng lifecycle_status
    // chưa được lưu (vẫn 'nháp') -> nâng lên 'đang bán' đúng ý người dùng.
    const r5 = await Package.updateMany(
      { lifecycle_status: 'nháp', is_active: true },
      {
        $set: {
          lifecycle_status: 'đang bán',
          status_changed_at: new Date(),
        }
      }
    );

    const total =
      (r1.modifiedCount || 0) +
      (r2.modifiedCount || 0) +
      (r3.modifiedCount || 0) +
      (r4.modifiedCount || 0) +
      (r5.modifiedCount || 0);
    if (total > 0) {
      console.log(`[Migration] Đã đồng bộ vòng đời cho ${total} gói tập cũ`);
    }
  } catch (err) {
    console.error('[Migration] Lỗi đồng bộ lifecycle_status:', err.message);
  }
};
