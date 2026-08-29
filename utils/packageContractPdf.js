import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildPriceTable } from "../services/pricingService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatVnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")} VND`;

/**
 * Sinh PDF "Hợp đồng + bảng giá theo gói" để in ra ký cho khách.
 * Bao gồm: thông tin gói, quyền lợi, cam kết A/B, điều khoản, bảng giá tự tính,
 * chữ ký Bên A (nếu cơ sở đã upload) và ô trống ký cho khách.
 */
export const generatePackageContractPdf = (pkg) => {
  const doc = new jsPDF();
  const pageWidth = 210;
  const margin = 20;
  const maxWidthText = pageWidth - margin * 2;
  let y = 20;

  // Font NotoSans hỗ trợ tiếng Việt
  const fontRegular = path.resolve(__dirname, "../assets/fonts/NotoSans-Regular.ttf");
  const fontBold = path.resolve(__dirname, "../assets/fonts/NotoSans-Bold.ttf");
  doc.addFileToVFS("NotoSans-Regular.ttf", fs.readFileSync(fontRegular).toString("base64"));
  doc.addFileToVFS("NotoSans-Bold.ttf", fs.readFileSync(fontBold).toString("base64"));
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  const ensureSpace = (needed) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const heading = (text) => {
    ensureSpace(16);
    doc.setFontSize(13);
    doc.setFont("NotoSans", "bold");
    doc.text(text, margin, y);
    y += 8;
  };

  const paragraph = (text, indent = 2) => {
    if (!text) return;
    doc.setFontSize(10);
    doc.setFont("NotoSans", "normal");
    const lines = doc.splitTextToSize(String(text), maxWidthText - indent);
    lines.forEach((line) => {
      ensureSpace(7);
      doc.text(line, margin + indent, y);
      y += 5;
    });
    y += 3;
  };

  // ===== Tiêu đề =====
  const location = pkg.locationId && typeof pkg.locationId === "object" ? pkg.locationId : null;

  doc.setFontSize(16);
  doc.setFont("NotoSans", "bold");
  doc.text("CÔNG TY TNHH ZENFITNESS", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(10);
  doc.setFont("NotoSans", "normal");
  doc.text(location?.title || "ZenFitness Gym", pageWidth / 2, y, { align: "center" });
  if (location?.address) {
    y += 5;
    doc.text(location.address, pageWidth / 2, y, { align: "center" });
  }

  y += 10;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(17);
  doc.setFont("NotoSans", "bold");
  doc.text("HỢP ĐỒNG ĐĂNG KÝ GÓI TẬP & BẢNG GIÁ", pageWidth / 2, y, { align: "center" });
  y += 12;

  // ===== Thông tin gói =====
  heading("THÔNG TIN GÓI TẬP");
  doc.setFontSize(11);
  doc.setFont("NotoSans", "normal");

  const disciplineName = pkg.combo
    ? (pkg.disciplines || []).map((d) => d?.name).filter(Boolean).join(", ")
    : pkg.disciplineId?.name || "";

  const infoRows = [
    ["Tên gói:", pkg.name],
    ["Bộ môn:", disciplineName || "N/A"],
    [
      "Buổi tập với HLV:",
      pkg.isFullMonth
        ? "Không giới hạn (full tháng)"
        : `${pkg.ptSessionsPerMonth || 0} buổi/tháng`,
    ],
    ["Đơn giá gốc:", `${formatVnd(pkg.unitPrice)} / tháng`],
  ];
  infoRows.forEach(([label, value]) => {
    ensureSpace(7);
    doc.text(`${label} ${value}`, margin + 2, y);
    y += 6;
  });

  if ((pkg.features || []).length > 0) {
    y += 2;
    doc.setFont("NotoSans", "bold");
    doc.text("Quyền lợi bao gồm:", margin + 2, y);
    y += 6;
    doc.setFont("NotoSans", "normal");
    pkg.features.forEach((f) => {
      ensureSpace(7);
      doc.text(`- ${f}`, margin + 4, y);
      y += 5;
    });
  }
  y += 4;

  // ===== Bảng giá tự tính =====
  heading("BẢNG GIÁ THEO THỜI HẠN (TỰ TÍNH THEO QUY TẮC)");
  const table = buildPriceTable(pkg);

  const colX = [margin, margin + 35, margin + 80, margin + 115];
  ensureSpace(10 + (table.rows.length + 1) * 8);
  doc.setFontSize(10);
  doc.setFont("NotoSans", "bold");
  doc.text("Thời hạn", colX[0], y);
  doc.text("Giảm giá", colX[1], y);
  doc.text("Đơn giá/tháng", colX[2], y);
  doc.text("Thành tiền", colX[3], y);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont("NotoSans", "normal");
  if (table.rows.length === 0) {
    doc.text("(Gói chưa cấu hình mức thời gian - tính giá lẻ theo tháng)", colX[0], y);
    y += 6;
  }
  table.rows.forEach((row) => {
    doc.text(`${row.months} tháng`, colX[0], y);
    doc.text(`-${row.discount_percent}%`, colX[1], y);
    doc.text(formatVnd(table.unit_price), colX[2], y);
    doc.text(formatVnd(row.total_price), colX[3], y);
    y += 6;
  });
  y += 4;

  // ===== Cam kết các bên =====
  if (pkg.contractA) {
    heading("CAM KẾT BÊN A (PHÒNG TẬP)");
    paragraph(pkg.contractA);
  }
  if (pkg.contractB) {
    heading("CAM KẾT BÊN B (HỘI VIÊN)");
    paragraph(pkg.contractB);
  }
  if (pkg.contractTerms) {
    heading("ĐIỀU KHOẢN KHÁC");
    paragraph(pkg.contractTerms);
  }

  // ===== Chữ ký =====
  ensureSpace(50);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("NotoSans", "bold");
  doc.text("CHỮ KÝ CỦA CÁC BÊN", margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont("NotoSans", "normal");
  doc.text("Đại diện Bên A:", margin, y);
  doc.text("Hội viên (Bên B):", margin + 100, y);
  y += 5;
  doc.text("(Ký, ghi họ tên)", margin, y);
  doc.text("(Ký, ghi họ tên)", margin + 100, y);
  y += 15;

  const sigW = 55;
  const sigH = 22;
  if (location?.signature) {
    try {
      doc.addImage(location.signature, "PNG", margin, y, sigW, sigH);
    } catch {
      doc.text("Không có chữ ký", margin, y + sigH / 2);
    }
  } else {
    doc.text("Không có chữ ký", margin, y + sigH / 2);
  }
  // Bên B để trống để khách ký trực tiếp

  y += sigH + 10;
  doc.setFontSize(9);
  doc.setFont("NotoSans", "italic");
  doc.text(
    "Bảng giá áp dụng tại thời điểm ký hợp đồng. Gia hạn sau sẽ theo bảng giá hiện hành.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
};
