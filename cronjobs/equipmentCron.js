import cron from "node-cron";
import Equipment from "../models/schemas/equipmentSchema.js";

export const startEquipmentCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const equipments = await Equipment.find({});

      for (const eq of equipments) {
        let isModified = false;

        if (
          eq.maintenance_cycle_months &&
          eq.maintenance_cycle_months > 0 &&
          eq.last_maintenance_date
        ) {
          const nextMaintenanceDate = new Date(eq.last_maintenance_date);
          nextMaintenanceDate.setMonth(
            nextMaintenanceDate.getMonth() + eq.maintenance_cycle_months,
          );

          if (now >= nextMaintenanceDate && eq.status !== "bảo trì") {
            const hasPendingMaintenance = eq.reports.some(
              (r) =>
                r.status === "pending" && r.reason.includes("Đến hạn bảo trì"),
            );

            if (!hasPendingMaintenance) {
              eq.status = "bảo trì";
              eq.reports.push({
                statusType: "bảo trì",
                affectedQuantity: eq.quantity,
                reason: "Hệ thống tự động: Đến hạn bảo trì định kỳ",
                reportedAt: now,
                status: "pending",
              });
              isModified = true;
            }
          }
        }

        if (eq.warranty_period && eq.warranty_period > 0 && eq.purchase_date) {
          const warrantyEndDate = new Date(eq.purchase_date);
          warrantyEndDate.setMonth(
            warrantyEndDate.getMonth() + eq.warranty_period,
          );

          const diffTime = warrantyEndDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 30 && diffDays > 0) {
            const hasPendingWarrantyAlert = eq.reports.some(
              (r) =>
                r.status === "pending" &&
                r.reason.includes("Sắp hết hạn bảo hành"),
            );

            if (!hasPendingWarrantyAlert) {
              eq.reports.push({
                statusType: "hoạt động",
                affectedQuantity: eq.quantity,
                reason: `Hệ thống cảnh báo: Sắp hết hạn bảo hành (còn ${diffDays} ngày)`,
                reportedAt: now,
                status: "pending",
              });
              isModified = true;
            }
          }
        }

        if (isModified) {
          const validationError = eq.validateSync();
          if (!validationError) {
            await eq.save();
          }
        }
      }
    } catch (error) {
      console.error(error.message);
    }
  });
};
