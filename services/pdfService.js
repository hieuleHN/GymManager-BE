import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const contractsDir = path.resolve('uploads/contracts');
const regularFont = path.resolve('fonts/NotoSans-Regular.ttf');
const boldFont = path.resolve('fonts/NotoSans-Bold.ttf');

if (!fs.existsSync(contractsDir)) {
  fs.mkdirSync(contractsDir, { recursive: true });
}

const formatPrice = (price) => {
  return price.toLocaleString('vi-VN') + 'đ';
};

export const generateContractPDF = async ({ registration, pkg, customer, policies }) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `contract_${registration._id}_${Date.now()}.pdf`;
      const filePath = path.join(contractsDir, fileName);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.registerFont('NotoSans', regularFont);
      doc.registerFont('NotoSans-Bold', boldFont);

      const regular = 'NotoSans';
      const bold = 'NotoSans-Bold';

      // Helper functions
      const drawLine = (y) => {
        doc.moveTo(50, y).lineTo(545, y).stroke('#cccccc');
      };

      // Header
      doc.font(bold).fontSize(22).text('CHÍNH SÁCH & ĐIỀU KHOẢN DỊCH VỤ', { align: 'center' });
      doc.font(regular).fontSize(14).text('Hợp đồng đăng ký gói tập', { align: 'center' });
      doc.moveDown(1.5);
      drawLine(doc.y);
      doc.moveDown(1);

      // I. Thông tin các bên
      doc.font(bold).fontSize(16).text('I. THÔNG TIN CÁC BÊN');
      doc.moveDown(0.5);

      doc.font(bold).fontSize(12).text('BÊN A (Bên cung cấp dịch vụ):');
      doc.font(regular).fontSize(11);
      doc.text(`  - Tên: ZENFITNESS`);
      doc.text(`  - Địa chỉ: ${customer?.locationId?.title || 'Hệ thống phòng tập ZenFitness'}`);
      doc.moveDown(0.5);

      doc.font(bold).fontSize(12).text('BÊN B (Hội viên):');
      doc.font(regular).fontSize(11);
      doc.text(`  - Họ tên: ${customer?.fullName || customer?.account || 'N/A'}`);
      doc.text(`  - Email: ${customer?.email || 'N/A'}`);
      doc.text(`  - Số điện thoại: ${customer?.phone || 'N/A'}`);
      doc.text(`  - Ngày ký: ${new Date().toLocaleDateString('vi-VN')}`);
      doc.moveDown(1);
      drawLine(doc.y);
      doc.moveDown(1);

      // II. Thông tin gói dịch vụ
      doc.font(bold).fontSize(16).text('II. THÔNG TIN GÓI DỊCH VỤ');
      doc.moveDown(0.5);
      doc.font(regular).fontSize(11);
      doc.text(`  - Gói tập: ${pkg.name}`);
      doc.text(`  - Thời hạn: ${registration.duration_months} tháng`);
      doc.text(`  - Cơ sở tập luyện: ${customer?.locationId?.title || 'ZenFitness'}`);
      doc.text(`  - Tổng giá trị: ${formatPrice(registration.total_price)}`);
      doc.moveDown(0.5);

      doc.font(bold).fontSize(11).text('Quyền lợi bao gồm:');
      doc.font(regular).fontSize(10);
      (pkg.features || []).forEach((feature) => {
        doc.text(`  - ${feature}`);
      });
      doc.moveDown(1);
      drawLine(doc.y);
      doc.moveDown(1);

      // III. Điều khoản bên A
      if (pkg.contractA) {
        doc.font(bold).fontSize(16).text('III. ĐIỀU KHOẢN BÊN A (Bên cung cấp dịch vụ)');
        doc.moveDown(0.5);
        doc.font(regular).fontSize(11).text(pkg.contractA);
        doc.moveDown(1);
        drawLine(doc.y);
        doc.moveDown(1);
      }

      // IV. Điều khoản bên B
      if (pkg.contractB) {
        doc.font(bold).fontSize(16).text('IV. ĐIỀU KHOẢN BÊN B (Hội viên)');
        doc.moveDown(0.5);
        doc.font(regular).fontSize(11).text(pkg.contractB);
        doc.moveDown(1);
        drawLine(doc.y);
        doc.moveDown(1);
      }

      // V. Điều khoản cam kết chung
      if (pkg.contractTerms) {
        doc.font(bold).fontSize(16).text('V. ĐIỀU KHOẢN CAM KẾT CHUNG (Cả hai bên)');
        doc.moveDown(0.5);
        doc.font(regular).fontSize(11).text(pkg.contractTerms);
        doc.moveDown(1);
        drawLine(doc.y);
        doc.moveDown(1);
      }

      // VI. Chính sách chung
      if (policies && policies.length > 0) {
        doc.font(bold).fontSize(16).text('VI. CHÍNH SÁCH CHUNG');
        doc.moveDown(0.5);
        doc.font(regular).fontSize(11);
        policies.forEach((policy, idx) => {
          doc.text(`${idx + 1}. ${policy.title}`);
          doc.text(`   ${policy.description}`);
          doc.moveDown(0.3);
        });
        doc.moveDown(1);
        drawLine(doc.y);
        doc.moveDown(1);
      }

      // Chữ ký
      doc.font(bold).fontSize(16).text('CHỮ KÝ CỦA HỘI VIÊN');
      doc.moveDown(1);

      // Convert base64 signature to image
      if (registration.signature) {
        const base64Data = registration.signature.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        try {
          doc.image(imgBuffer, { width: 200, align: 'center' });
        } catch (e) {
          doc.font(regular).fontSize(11).text('[Chữ ký đã được ghi nhận]');
        }
      } else {
        doc.font(regular).fontSize(11).text('[Chưa có chữ ký]');
      }

      doc.moveDown(1);
      doc.font(regular).fontSize(10).fillColor('#888888')
        .text(`Hợp đồng được tạo ngày: ${new Date().toLocaleString('vi-VN')}`, { align: 'center' });
      doc.text(`Mã hợp đồng: ${registration._id}`, { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(fileName));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};
