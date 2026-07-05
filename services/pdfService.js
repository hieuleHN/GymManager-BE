import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const FONT_PATH = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_BOLD_PATH = 'C:\\Windows\\Fonts\\arialbd.ttf';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

export const generateContractPDF = async ({ registration, pkg, customer, policies }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
      const fileName = `contract_${registration._id}_${Date.now()}.pdf`;
      const outputPath = path.resolve('uploads/contracts', fileName);

      const fontExists = fs.existsSync(FONT_PATH);
      if (fontExists) {
        doc.registerFont('Arial', FONT_PATH);
        doc.registerFont('Arial-Bold', FONT_BOLD_PATH);
      }

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const font = fontExists ? 'Arial' : 'Helvetica';
      const fontBold = fontExists ? 'Arial-Bold' : 'Helvetica-Bold';

      doc.font(fontBold).fontSize(20).text('HỢP ĐỒNG ĐĂNG KÝ GÓI TẬP', { align: 'center' });
      doc.moveDown(0.5);
      doc.font(font).fontSize(11).text('Phòng Gym ZenFitness', { align: 'center' });
      doc.moveDown(0.5);

      doc.font(font).fontSize(10).text(`Mã hợp đồng: ${registration._id}`, { align: 'right' });
      doc.text(`Ngày tạo: ${formatDate(registration.createdAt || new Date())}`, { align: 'right' });
      doc.moveDown(1);

      doc.font(fontBold).fontSize(13).text('THÔNG TIN KHÁCH HÀNG');
      doc.moveDown(0.3);

      const customerFields = [
        ['Họ và tên:', customer?.fullName || ''],
        ['Giới tính:', customer?.gender || ''],
        ['Số điện thoại:', customer?.phone || ''],
        ['Email:', customer?.email || ''],
        ['Địa chỉ:', customer?.address || ''],
        ['Số CMND/CCCD:', customer?.idNumber || ''],
        ['Tài khoản:', customer?.account || ''],
      ];

      doc.font(font).fontSize(10);
      customerFields.forEach(([label, value]) => {
        doc.text(`  ${label}  ${value}`);
      });
      doc.moveDown(1);

      doc.font(fontBold).fontSize(13).text('THÔNG TIN GÓI TẬP');
      doc.moveDown(0.3);

      doc.font(font).fontSize(10);
      doc.text(`  Tên gói tập:  ${pkg?.name || ''}`);
      doc.text(`  Giá gói:  ${formatCurrency(pkg?.price)}`);
      doc.text(`  Đơn giá:  ${formatCurrency(pkg?.unitPrice)}`);

      if (pkg?.features && pkg.features.length > 0) {
        doc.text('  Tính năng:');
        pkg.features.forEach(f => doc.text(`    - ${f}`));
      }

      doc.moveDown(1);

      doc.font(fontBold).fontSize(13).text('THÔNG TIN ĐĂNG KÝ');
      doc.moveDown(0.3);

      doc.font(font).fontSize(10);
      doc.text(`  Ngày bắt đầu:  ${formatDate(registration.start_date)}`);
      doc.text(`  Ngày kết thúc:  ${formatDate(registration.end_date)}`);
      doc.text(`  Thời hạn:  ${registration.duration_months} tháng`);
      doc.text(`  Tổng tiền:  ${formatCurrency(registration.total_price)}`);
      doc.text(`  Trạng thái thanh toán:  ${registration.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}`);
      doc.text(`  Trạng thái:  ${registration.status || ''}`);
      doc.moveDown(1);

      if (policies && policies.length > 0) {
        doc.font(fontBold).fontSize(13).text('CHÍNH SÁCH & ĐIỀU KHOẢN');
        doc.moveDown(0.3);
        doc.font(font).fontSize(10);
        policies.forEach((policy, index) => {
          doc.text(`  ${index + 1}. ${policy.title || ''}`);
          if (policy.description) {
            doc.fontSize(9).text(`     ${policy.description}`, { indent: 10 });
            doc.fontSize(10);
          }
        });
        doc.moveDown(1);
      }

      if (pkg?.contractA || pkg?.contractB || pkg?.contractTerms) {
        doc.font(fontBold).fontSize(13).text('ĐIỀU KHOẢN HỢP ĐỒNG');
        doc.moveDown(0.3);
        doc.font(font).fontSize(10);

        if (pkg.contractA) {
          doc.text(`  Bên A (Chủ sở hữu):  ${pkg.contractA}`);
        }
        if (pkg.contractB) {
          doc.text(`  Bên B (Khách hàng):  ${pkg.contractB}`);
        }
        if (pkg.contractTerms) {
          doc.moveDown(0.3);
          doc.text(`  Điều khoản:  ${pkg.contractTerms}`);
        }
        doc.moveDown(1);
      }

      if (registration.signature) {
        doc.font(fontBold).fontSize(13).text('CHỮ KÝ ĐIỆN TỬ');
        doc.moveDown(0.3);
        doc.font(font).fontSize(10);
        doc.text(`  Chữ ký: ${registration.signature}`);
        doc.text(`  Ngày ký: ${formatDate(registration.createdAt || new Date())}`);
        doc.moveDown(1);
      }

      doc.moveDown(2);
      const today = new Date();
      doc.font(font).fontSize(10).text(`Hà Nội, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, { align: 'right' });
      doc.moveDown(0.5);

      doc.font(fontBold).fontSize(10);
      doc.text('Chủ sở hữu', { align: 'left' });
      doc.moveDown(3);
      doc.text('(Ký, ghi rõ họ tên)', { align: 'left' });

      doc.text('Khách hàng', { align: 'right' });
      doc.moveDown(3);
      doc.text('(Ký, ghi rõ họ tên)', { align: 'right' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(fileName);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};
