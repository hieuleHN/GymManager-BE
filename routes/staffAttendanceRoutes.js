import express from 'express';
import excelJS from "exceljs";
import { authenticateToken } from '../middleware/authMiddleware.js';
import { generateQR, verifyQR, todayAttendance, attendanceHistory, attendanceStats, attendanceAbsences, exportDailyDetail } from '../controllers/staffAttendanceController.js';
import StaffAttendance from '../models/schemas/staffAttendanceSchema.js';

const router = express.Router();

router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0,10);
    const [y,m,d] = dateStr.split('-').map(Number);
    const start = new Date(y, m-1, d, 0,0,0);
    const end = new Date(y, m-1, d, 23,59,59,999);
    const records = await StaffAttendance.find({ date: { $gte: start, $lte: end } })
      .populate('staffId', 'fullName account phone email')
      .populate('shiftId', 'shift').sort({ checkInTime: 1 }).lean();
    if (!records.length) return res.status(404).json({ message: "Không có dữ liệu chấm công trong ngày này!" });
    const workbook = new excelJS.Workbook();
    const ws = workbook.addWorksheet("ChamCong_NhanVien");
    ws.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ và tên", key: "fullName", width: 22 },
      { header: "Tài khoản", key: "account", width: 16 },
      { header: "SĐT", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 24 },
      { header: "Ca", key: "shift", width: 16 },
      { header: "Check-in", key: "checkIn", width: 16 },
      { header: "Check-out", key: "checkOut", width: 16 },
      { header: "Đi muộn (phút)", key: "late", width: 14 },
      { header: "Về sớm (phút)", key: "early", width: 14 },
      { header: "Tăng ca (phút)", key: "overtime", width: 14 },
      { header: "Trạng thái", key: "status", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    records.forEach((r,i) => {
      const st = r.staffId || {};
      ws.addRow({
        stt: i+1,
        fullName: st.fullName || "",
        account: st.account || "",
        phone: st.phone || "",
        email: st.email || "",
        shift: r.shiftId?.shift || "",
        checkIn: r.checkInTime ? new Date(r.checkInTime).toLocaleString("vi-VN") : "",
        checkOut: r.checkOutTime ? new Date(r.checkOutTime).toLocaleString("vi-VN") : "",
        late: r.minutesLate || "",
        early: r.minutesEarly || "",
        overtime: r.overtime || "",
        status: r.status,
      });
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=ChamCong_NhanVien_${dateStr}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/qr', authenticateToken, generateQR);
router.post('/verify', authenticateToken, verifyQR);
router.get('/today', authenticateToken, todayAttendance);
router.get('/history', authenticateToken, attendanceHistory);
router.get('/stats', authenticateToken, attendanceStats);
router.get('/absences', authenticateToken, attendanceAbsences);
router.get('/export/daily-detail', authenticateToken, exportDailyDetail);

export default router;
