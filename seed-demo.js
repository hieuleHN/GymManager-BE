import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Customer from "./models/schemas/customerSchema.js";
import Staff from "./models/schemas/staffSchema.js";
import Job from "./models/schemas/jobSchema.js";
import Location from "./models/schemas/locationSchema.js";
import Discipline from "./models/schemas/disciplineSchema.js";
import Package from "./models/schemas/packageSchema.js";
import UserPackage from "./models/schemas/userPackageSchema.js";
import Booking from "./models/schemas/bookingSchema.js";
import CheckIn from "./models/schemas/checkInSchema.js";
import StaffShift from "./models/schemas/staffShiftSchema.js";
import StaffAttendance from "./models/schemas/staffAttendanceSchema.js";
import Equipment from "./models/schemas/equipmentSchema.js";
import Product from "./models/schemas/productSchema.js";
import Expense from "./models/schemas/expenseSchema.js";
import { LockerV2 } from "./models/lockerManagementModel.js";
import Permission from "./models/schemas/permissionSchema.js";
import Article from "./models/schemas/articleSchema.js";
import ServiceRequest from "./models/schemas/serviceRequestSchema.js";
import Service from "./models/schemas/serviceSchema.js";
import Recruitment from "./models/schemas/recruitmentSchema.js";
import WalletTransaction from "./models/schemas/walletTransactionSchema.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/gymmanager";
const CLEAN = process.argv.includes("--clean");

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const fakeFace = () => Array.from({ length: 128 }, () => Math.random() * 2 - 1);

async function connect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected", MONGODB_URI);
  }
}

async function clean() {
  if (!CLEAN) return;
  console.log("🧹 Cleaning...");
  await Promise.all([
    Customer.deleteMany({}),
    Staff.deleteMany({}),
    Job.deleteMany({}),
    Location.deleteMany({}),
    Discipline.deleteMany({}),
    Package.deleteMany({}),
    UserPackage.deleteMany({}),
    Booking.deleteMany({}),
    CheckIn.deleteMany({}),
    StaffShift.deleteMany({}),
    StaffAttendance.deleteMany({}),
    Equipment.deleteMany({}),
    Product.deleteMany({}),
    Expense.deleteMany({}),
    LockerV2.deleteMany({}),
    Permission.deleteMany({}),
    Article.deleteMany({}),
    ServiceRequest.deleteMany({}),
    Service.deleteMany({}),
    Recruitment.deleteMany({}),
    WalletTransaction.deleteMany({}),
  ]);
  console.log("✅ Cleaned");
}

async function createLocations() {
  const existing = await Location.find({});
  if (existing.length >= 3 && !CLEAN) {
    console.log(`✅ Locations đã có sẵn ${existing.length}, dùng lại (dùng --clean để tạo mới)`);
    return existing.slice(0,3);
  }
  if (existing.length > 0 && CLEAN) {
    // clean() đã xóa rồi, nhưng đảm bảo
  } else if (existing.length >= 3) {
    return existing.slice(0,3);
  }
  const locs = await Location.insertMany([
    { title: "ZenFitness Quận 1", address: "123 Nguyễn Huệ, Quận 1, TP.HCM", phone: "0901234567", openTime: "05:00", closeTime: "22:00" },
    { title: "ZenFitness Quận 7", address: "456 Nguyễn Thị Thập, Quận 7, TP.HCM", phone: "0901234568", openTime: "05:00", closeTime: "22:00" },
    { title: "ZenFitness Bình Thạnh", address: "789 Điện Biên Phủ, Bình Thạnh, TP.HCM", phone: "0901234569", openTime: "05:00", closeTime: "22:00" },
  ]);
  console.log(`✅ Locations: ${locs.length}`);
  return locs;
}

async function createDisciplines(locs) {
  const names = ["Gym", "Yoga", "Boxing", "Pilates", "CrossFit", "Zumba"];
  const all = [];
  for (const loc of locs) {
    for (const n of names) {
      all.push({ name: n, description: `Bộ môn ${n}`, locationId: loc._id });
    }
  }
  const docs = await Discipline.insertMany(all);
  console.log(`✅ Disciplines: ${docs.length}`);
  return docs;
}

async function createJobs() {
  const jobs = await Job.insertMany([
    { name: "Admin", description: "Quản trị hệ thống", isAdmin: true, permissions: [] },
    { name: "Quản lý", description: "Quản lý chi nhánh", isAdmin: false, permissions: ["quan_ly", "staff", "customers", "statistics"] },
    { name: "Lễ tân", description: "Lễ tân", isAdmin: false, permissions: ["le_tan", "customers", "attendance"] },
    { name: "Huấn luyện viên", description: "HLV", isAdmin: false, permissions: ["huan_luyen_vien", "training", "schedule"] },
    { name: "Kế toán", description: "Kế toán", isAdmin: false, permissions: ["ke_toan", "statistics", "payment"] },
  ]);
  console.log(`✅ Jobs: ${jobs.length}`);
  // Permissions
  for (const j of jobs) {
    const perms = j.permissions.map(p => ({ feature: p, actions: ["view", "create", "read", "update", "delete"] }));
    if (j.isAdmin) {
      // admin has all
      const all = ["statistics","customers","equipment","packages","services","attendance","products","clubs","staff","tasks","payment","training","schedule","wallet"];
      for (const f of all) if (!perms.find(x=>x.feature===f)) perms.push({ feature: f, actions: ["view","create","read","update","delete"]});
    }
    await Permission.findOneAndUpdate({ jobId: j._id }, { jobId: j._id, permissions: perms }, { upsert: true });
  }
  console.log(`✅ Permissions seeded`);
  return jobs;
}

async function ensureAdminAccount(locs, jobs) {
  const adminJob = jobs.find(j => j.name === "Admin");
  if (!adminJob) return null;
  const existing = await Staff.findOne({ account: "admin" });
  if (existing) {
    console.log(`✅ Admin đã tồn tại: admin / admin123`);
    const isMatch = await bcrypt.compare("admin123", existing.password);
    if (!isMatch) {
      existing.password = await bcrypt.hash("admin123", 10);
      await existing.save();
      console.log(`🔄 Đã cập nhật mật khẩu admin -> admin123`);
    }
    return existing;
  }
  const hashAdmin = await bcrypt.hash("admin123", 10);
  const doc = await Staff.create({
    account: "admin",
    password: hashAdmin,
    fullName: "Admin",
    email: "admin@gym.com",
    phone: "0900000000",
    gender: "Nam",
    job: adminJob._id,
    locationId: locs[0]?._id || null,
    status: "active",
    address: "Hệ thống",
    baseSalary: 20000000,
    description: "Quản trị hệ thống",
  });
  console.log(`✅ Admin: admin / admin123 (isAdmin=true)`);
  return doc;
}

async function createStaff(locs, jobs, disciplines) {
  const hash = await bcrypt.hash("123123", 10);
  const jobMap = Object.fromEntries(jobs.map(j => [j.name, j]));
  const staffList = [];
  const realStaffNames = [
    "Lê Thị Tuyết", "Nguyễn Công Sơn", "Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường", "Phạm Thị Dung", "Hoàng Văn Dũng", "Vũ Thị Hà",
    "Đặng Thị Hào", "Bùi Thị Hương", "Đỗ Văn Khánh", "Hồ Thị Linh", "Ngô Văn Minh", "Phan Thị Ngọc", "Trịnh Văn Phong", "Lý Thị Thảo",
    "Đinh Văn Quân", "Võ Thị Uyên", "Bùi Văn Việt", "Nguyễn Thị Tùng", "Trần Văn Hải", "Lê Thị Nam", "Phạm Công Sơn", "Hoàng Thị Yến",
    "Vũ Văn Đức", "Đặng Thị Hà", "Ngô Thị Linh", "Phan Văn Minh", "Trịnh Thị Ngọc", "Lý Văn Phúc", "Đinh Thị Quỳnh", "Võ Văn Sơn",
    "Bùi Thị Tâm", "Nguyễn Văn Tùng", "Trần Thị Hải", "Lê Văn Nam", "Phạm Thị Hào", "Hoàng Văn Kiên", "Vũ Văn Tài", "Đặng Thị Thu",
    "Ngô Công Hải", "Phan Thị Trang", "Trịnh Văn Thắng", "Lý Thị Hồng", "Đinh Văn Huy", "Võ Thị Nhung", "Bùi Văn Thành", "Nguyễn Thị Kim"
  ];
  const clubCode = (title) => {
    if (title.includes("Quận 1")) return "Q1";
    if (title.includes("Quận 7")) return "Q7";
    return "BT";
  };
  const jobCode = (name) => {
    if (name === "Quản lý") return "ql";
    if (name === "Lễ tân") return "lt";
    return "hlv";
  };
  let staffNameIdx = 0;
  for (const loc of locs) {
    const ccode = clubCode(loc.title);
    const perLoc = [
      { job: jobMap["Quản lý"], count: 1 },
      { job: jobMap["Lễ tân"], count: 3 },
      { job: jobMap["Huấn luyện viên"], count: 16 },
    ];
    for (const { job, count } of perLoc) {
      for (let i = 0; i < count; i++) {
        const fullName = realStaffNames[staffNameIdx++ % realStaffNames.length];
        const account = `nv_${ccode}_${jobCode(job.name)}_${String(i+1).padStart(2,"0")}`;
        const isTrainer = job.name === "Huấn luyện viên";
        const disc = isTrainer ? pick(disciplines.filter(d => String(d.locationId) === String(loc._id))) : null;
        const dob = new Date(); dob.setFullYear(dob.getFullYear() - rand(22, 45)); dob.setMonth(rand(0,11)); dob.setDate(rand(1,28));
        const specialties = isTrainer ? [pick(disciplines.filter(d => String(d.locationId) === String(loc._id)))?.name || "Gym"].filter(Boolean).concat(rand(0,1) ? [pick(["Yoga","Boxing","Pilates","CrossFit"])] : []) : [];
        const certs = isTrainer ? Array.from({ length: rand(1,3) }, () => pick(["Chứng chỉ PT Quốc tế NASM","Chứng chỉ HLV Yoga 200h","Chứng chỉ Dinh dưỡng Thể hình","Chứng chỉ Sơ cứu","Chứng chỉ CrossFit L1"])) : [];
        staffList.push({
          account,
          password: hash,
          fullName,
          email: `${account}@zenfitness.vn`,
          phone: `090${rand(1000000, 9999999)}`,
          gender: Math.random() > 0.5 ? "Nam" : "Nữ",
          dateOfBirth: dob,
          job: job._id,
          locationId: loc._id,
          status: "active",
          avatar: "",
          coverImage: "",
          description: isTrainer ? `${fullName} là ${job.name} với ${rand(2,10)} năm kinh nghiệm, chuyên ${specialties.join(", ")}` : `${fullName} - ${job.name} tại ${loc.title}`,
          address: `${rand(1,200)} Đường ${pick(["Lê Lợi","Nguyễn Trãi","Trần Hưng Đạo","Hai Bà Trưng","Điện Biên Phủ"])} , ${loc.title}`,
          specialties,
          gallery: [],
          rating: isTrainer ? Number((Math.random()*2+3).toFixed(1)) : 0,
          totalReviews: isTrainer ? rand(5, 80) : 0,
          experience: isTrainer ? `${rand(2,10)} năm kinh nghiệm` : "",
          certifications: certs,
          disciplineId: disc?._id || null,
          pricePerSession: isTrainer ? rand(3, 8) * 100000 : 500000,
          commissionPT: isTrainer ? pick([20,30,35,40]) : 0,
        });
      }
    }
  }
  const docs = await Staff.insertMany(staffList);
  console.log(`✅ Staff: ${docs.length} (mỗi CLB 1 QL + 3 LT + 16 HLV)`);
  return docs;
}

async function createCustomers(locs) {
  const hash = await bcrypt.hash("123123", 10);
  const customers = [];
  const realCustomerNames = [
    "Lê Thị Tuyết", "Nguyễn Công Sơn", "Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường", "Phạm Thị Dung", "Hoàng Văn Dũng", "Vũ Thị Hà",
    "Đặng Thị Hào", "Bùi Thị Hương", "Đỗ Văn Khánh", "Hồ Thị Linh", "Ngô Văn Minh", "Phan Thị Ngọc", "Trịnh Văn Phong", "Lý Thị Thảo",
    "Đinh Văn Quân", "Võ Thị Uyên", "Bùi Văn Việt", "Nguyễn Thị Tùng", "Trần Văn Hải", "Lê Thị Nam", "Phạm Công Sơn", "Hoàng Thị Yến",
    "Vũ Văn Đức", "Đặng Thị Hà", "Ngô Thị Linh", "Phan Văn Minh", "Trịnh Thị Ngọc", "Lý Văn Phúc", "Đinh Thị Quỳnh", "Võ Văn Sơn",
    "Bùi Thị Tâm", "Nguyễn Văn Tùng", "Trần Thị Hải", "Lê Văn Nam", "Phạm Thị Hào", "Hoàng Văn Kiên", "Vũ Văn Tài", "Đặng Thị Thu",
    "Ngô Công Hải", "Phan Thị Trang", "Trịnh Văn Thắng", "Lý Thị Hồng", "Đinh Văn Huy", "Võ Thị Nhung", "Bùi Văn Thành", "Nguyễn Thị Kim",
    "Trần Văn Phúc", "Lê Thị Ánh", "Phạm Văn Bảo", "Hoàng Thị Chi", "Vũ Văn Đạt", "Đặng Thị Diệp", "Ngô Văn Giang", "Phan Thị Hoa",
    "Trịnh Văn Hưng", "Lý Thị Khanh", "Đinh Văn Khoa", "Võ Thị Lam", "Bùi Văn Lộc", "Nguyễn Thị Mai", "Trần Văn Nghĩa", "Lê Thị Oanh",
    "Phạm Văn Phú", "Hoàng Thị Quyên", "Vũ Văn Quyết", "Đặng Thị Tâm", "Ngô Văn Thắng", "Phan Thị Thơm", "Trịnh Văn Tín", "Lý Thị Vân",
    "Đinh Văn Vũ", "Võ Thị Xuân", "Bùi Văn Yên", "Nguyễn Thị Ánh", "Trần Văn Bách", "Lê Thị Cúc", "Phạm Văn Đạt", "Hoàng Thị Dung",
    "Vũ Văn Hải", "Đặng Thị Hằng", "Ngô Văn Hậu", "Phan Thị Hiền", "Trịnh Văn Hoàng", "Lý Thị Huyền", "Đinh Văn Khải", "Võ Thị Lan",
    "Bùi Văn Lực", "Nguyễn Thị Ly", "Trần Văn Mạnh", "Lê Thị Ngân", "Phạm Văn Nhân", "Hoàng Thị Nhàn", "Vũ Văn Phát", "Đặng Thị Phượng",
    "Ngô Văn Quang", "Phan Thị Quỳnh", "Trịnh Văn Sang", "Lý Thị Sương", "Đinh Văn Tài", "Võ Thị Thắm", "Bùi Văn Thiện", "Nguyễn Thị Thúy",
    "Trần Văn Toàn", "Lê Thị Trúc", "Phạm Văn Tùng", "Hoàng Thị Vân", "Vũ Văn Vương", "Đặng Thị Xuân", "Ngô Văn Yên", "Phan Thị Yến"
  ];
  const custClubCode = (title) => title.includes("Quận 1") ? "q1" : title.includes("Quận 7") ? "q7" : "bt";
  let custNameIdx = 0;
  const perLocCounts = [50, 50, 50];
  for (let li = 0; li < locs.length; li++) {
    const loc = locs[li];
    const cnt = perLocCounts[li] || 33;
    const ccode = custClubCode(loc.title);
    for (let i = 0; i < cnt; i++) {
      const fullName = realCustomerNames[custNameIdx++ % realCustomerNames.length];
      const account = `hv_${ccode}_${String(i+1).padStart(2,"0")}`;
      // Rải ngày đăng ký đều từ đầu năm đến nay để biểu đồ tăng trưởng + chi tiết tháng nào cũng có dữ liệu
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const spanDays = Math.max(1, Math.floor((Date.now() - yearStart.getTime()) / 86400000));
      const regOffset = Math.min(spanDays, Math.floor((i / cnt) * spanDays + rand(0, Math.ceil(spanDays / cnt))));
      const registerDate = new Date(yearStart.getTime() + regOffset * 86400000);
      registerDate.setHours(rand(8, 20), rand(0, 59), 0, 0);
      const createdAt = new Date(Math.min(registerDate.getTime() + rand(0, 3) * 86400000, Date.now()));
      customers.push({
        account,
        password: hash,
        fullName,
        gender: Math.random() > 0.5 ? "Nam" : "Nữ",
        phone: `091${rand(1000000, 9999999)}`,
        email: `${account}@gmail.com`,
        address: `${rand(1,200)} Đường ${pick(["Lê Lợi","Nguyễn Trãi","Trần Hưng Đạo","Hai Bà Trưng"])}`,
        idNumber: `${rand(100000000000, 999999999999)}`,
        locationId: loc._id,
        status: "approved", // dữ liệu mẫu: tất cả đã duyệt, không tạo tài khoản chờ xác nhận
        registerDate,
        faceDescriptor: Math.random() > 0.4 ? fakeFace() : [],
        balance: rand(0, 5000000),
        createdAt,
      });
    }
  }
  const docs = await Customer.insertMany(customers);
  console.log(`✅ Customers: ${docs.length} (150 hội viên, mật khẩu 123123)`);
  return docs;
}

async function createPackages(locs, disciplines) {
  const pkgs = [];
  const base = [
    { name: "Gói 1 Tháng", short: "Gói 1T", months: 1, price: 800000, pt: 0, full: false },
    { name: "Gói 3 Tháng", short: "Gói 3T", months: 3, price: 700000, pt: 4, full: false },
    { name: "Gói 6 Tháng PT", short: "Gói 6T PT", months: 6, price: 650000, pt: 8, full: false },
    { name: "Gói 12 Tháng Full PT", short: "Gói 12T Full", months: 12, price: 600000, pt: 0, full: true },
    { name: "Gói VIP 3 Tháng", short: "Gói VIP 3T", months: 3, price: 1200000, pt: 12, full: false },
    { name: "Gói Sinh Viên 1 Tháng", short: "Gói SV 1T", months: 1, price: 500000, pt: 2, full: false },
    { name: "Gói Gia Đình 6 Tháng", short: "Gói GD 6T", months: 6, price: 550000, pt: 6, full: false },
    { name: "Gói Premium 12 Tháng", short: "Gói Pre 12T", months: 12, price: 900000, pt: 10, full: false },
  ];
  const pkgClubCode = (title) => title.includes("Quận 1") ? "Q1" : title.includes("Quận 7") ? "Q7" : "BT";
  // Mỗi gói có 5 mốc thời hạn để khách chọn (càng dài giảm càng sâu)
  const discFor = (m) => (m >= 12 ? 15 : m >= 6 ? 10 : m >= 5 ? 8 : m >= 3 ? 5 : 0);
  const stdDurations = [1, 3, 5, 6, 12];
  for (const loc of locs) {
    const ccode = pkgClubCode(loc.title);
    const locDiscs = disciplines.filter(d => String(d.locationId) === String(loc._id));
    for (const b of base) {
      const disc = pick(locDiscs);
      const durations = [
        { months: b.months, discount: discFor(b.months) },
        ...stdDurations.filter((m) => m !== b.months).map((m) => ({ months: m, discount: discFor(m) })),
      ];
      pkgs.push({
        name: `${b.short} - ${ccode}`,
        unitPrice: b.price,
        price: b.price,
        durations,
        disciplineId: disc?._id || null,
        locationId: loc._id,
        is_active: true,
        lifecycle_status: "đang bán",
        features: ["Tập không giới hạn", "Tư vấn dinh dưỡng", "Tủ đồ miễn phí", "HLV cá nhân"],
        ptSessionsPerMonth: b.pt,
        isFullMonth: b.full,
        description: `Gói tập ${b.name} tại ${loc.title}`,
        contractA: `Bên A (ZenFitness ${loc.title}) cam kết cung cấp đầy đủ cơ sở vật chất, HLV chuyên nghiệp, đảm bảo an toàn cho hội viên trong ${b.months} tháng.`,
        contractB: `Bên B cam kết tuân thủ nội quy phòng tập, thanh toán đúng hạn, bảo quản tài sản chung và tập luyện đúng giáo án HLV giao.`,
        contractTerms: `Điều khoản chung: Gói ${b.name} có thời hạn ${b.months} tháng, không hoàn phí sau 7 ngày kể từ ngày kích hoạt, được bảo lưu tối đa 2 tháng nếu có lý do chính đáng.`,
      });
    }
  }
  const docs = await Package.insertMany(pkgs);
  console.log(`✅ Packages: ${docs.length} (8 gói/CLB)`);
  return docs;
}

async function createUserPackages(customers, packages) {
  const ups = [];
  for (const cust of customers) {
    if (Math.random() < 0.05) continue; // chỉ 5% chưa mua, còn lại đều có gói
    const count = rand(2, 4); // mỗi khách 2-4 gói
    const ownedPkgIds = new Set(); // mỗi khách chỉ sở hữu mỗi mẫu gói 1 lần (tránh trùng gói còn hạn)
    for (let i = 0; i < count; i++) {
      const available = packages.filter(p => String(p.locationId) === String(cust.locationId) && !ownedPkgIds.has(String(p._id)));
      if (!available.length) break;
      const pkg = pick(available);
      ownedPkgIds.add(String(pkg._id));
      if (!pkg) continue;
      const months = pkg.durations[0].months;
      const isFull = pkg.isFullMonth;
      const pt = pkg.ptSessionsPerMonth;
      const start = new Date(Date.now() - rand(0, 90)*24*3600*1000);
      const end = new Date(start); end.setMonth(end.getMonth() + months);
      const daysLeft = Math.ceil((end - Date.now()) / (1000*60*60*24));
      // FIX history: bổ sung phương thức thanh toán để cột Phương thức không trống
      const payment_status = pick(["đã thanh toán","đã thanh toán","đã thanh toán","chờ thanh toán"]);
      const payment_method = payment_status === "đã thanh toán"
        ? pick(["vnpay","vnpay","wallet","momo","bank-transfer","bank-card","qr-code"])
        : pick(["vnpay","bank-transfer","qr-code",""]);
      // Trạng thái suy từ hạn thực tế + thanh toán (không random bừa để tránh "còn 10 ngày" nhưng còn 296 ngày)
      let status;
      let frozenAt = null, frozenUntil = null;
      if (daysLeft <= 0) {
        status = "hết hạn";
      } else if (payment_status !== "đã thanh toán") {
        status = "chờ xác nhận";
      } else if (daysLeft <= 10) {
        status = "còn 10 ngày";
      } else if (Math.random() < 0.12) {
        status = "đang tạm ngưng";
        frozenAt = new Date(Date.now() - rand(3, 20)*24*3600*1000);
        frozenUntil = new Date(frozenAt); frozenUntil.setMonth(frozenUntil.getMonth() + rand(1, 2));
      } else {
        status = "đang hoạt động";
      }
      const monthlySessions = [];
      if (pt > 0 && !isFull) {
        for (let m = 0; m < months; m++) {
          const d = new Date(start); d.setMonth(d.getMonth() + m);
          monthlySessions.push({ month: d.getMonth()+1, year: d.getFullYear(), total: pt, used: rand(0, pt) });
        }
      }
      const total_price = pkg.unitPrice * months * (1 - (pkg.durations[0].discount||0)/100);
      const vnpayTxnRef = payment_method === "vnpay" ? `VNP${String(cust._id).slice(-6).toUpperCase()}${Date.now().toString().slice(-6)}${rand(100,999)}` : null;
      const vnpayBankCode = payment_method === "vnpay" ? pick(["NCB","VISA","MB","BIDV","VIETCOM","TECH","VP","ACB"]) : null;
      const vnpayBankTranNo = payment_method === "vnpay" && payment_status === "đã thanh toán" ? `VT${rand(10000000,99999999)}` : null;
      const vnpayCardType = payment_method === "vnpay" ? pick(["ATM","VISA","MASTERCARD"]) : null;
      const vnpayTransactionNo = payment_method === "vnpay" && payment_status === "đã thanh toán" ? `${rand(10000000,99999999)}` : null;
      ups.push({
        customer_id: cust._id,
        package_id: pkg._id,
        locationId: cust.locationId,
        duration_months: months,
        ptSessionsPerMonth: pt,
        isFullMonth: isFull,
        monthlySessions,
        total_price,
        start_date: start,
        end_date: end,
        status,
        payment_status,
        payment_method,
        payment_date: payment_status === "đã thanh toán" ? start : null,
        frozenAt, frozenUntil,
        vnpay_txn_ref: vnpayTxnRef,
        vnpay_bank_code: vnpayBankCode,
        vnpay_bank_tran_no: vnpayBankTranNo,
        vnpay_card_type: vnpayCardType,
        vnpay_transaction_no: vnpayTransactionNo,
        confirmed_by: null,
        confirmed_at: start,
        createdAt: start,
      });
    }
  }
  const docs = await UserPackage.insertMany(ups);
  console.log(`✅ UserPackages: ${docs.length} (2-4 gói/khách, ~250-350) | đã bổ sung payment_method + vnpay để hiện cột Phương thức/Số dư`);
  return docs;
}

async function createBookings(customers, staff) {
  const trainers = staff.filter(s => s.pricePerSession && s.pricePerSession >= 300000);
  if (!trainers.length) return [];
  const bookings = [];
  for (let i = 0; i < 500; i++) {
    const cust = pick(customers.filter(c => c.status === "approved"));
    const trainer = pick(trainers.filter(t => String(t.locationId) === String(cust.locationId)));
    if (!trainer || !cust) continue;
    const date = new Date(); date.setDate(date.getDate() + rand(-7, 14));
    date.setHours(0,0,0,0);
    const slot = pick([
      { start: "06:00", end: "07:30" },
      { start: "07:30", end: "09:00" },
      { start: "09:00", end: "10:30" },
      { start: "10:30", end: "12:00" },
      { start: "13:30", end: "15:00" },
      { start: "15:00", end: "16:30" },
      { start: "16:30", end: "18:00" },
      { start: "18:00", end: "19:30" },
    ]);
    const createdAt = new Date(Date.now() - rand(0, 72)*3600*1000);
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / 3600000;
    const isPastDate = date < new Date(new Date().setHours(0,0,0,0));
    let status, paymentStatus;
    const isToday = date.toDateString() === new Date().toDateString();
    if (hoursSinceCreation > 24) {
      status = "cancelled";
      paymentStatus = "cancelled";
    } else if (isPastDate) {
      status = pick(["confirmed","confirmed","cancelled"]);
      paymentStatus = "paid";
    } else if (isToday && Math.random() < 0.2) {
      status = "pending"; paymentStatus = "pending";
    } else {
      status = pick(["confirmed","confirmed","cancelled"]);
      paymentStatus = "paid";
    }
    // FIX history: bổ sung phương thức để cột Phương thức không trống
    let paymentMethod = "";
    let vnpayTxnRef = "", vnpayBankCode = "", vnpayBankTranNo = "", vnpayCardType = "", vnpayTransactionNo = "";
    if (paymentStatus === "paid") {
      paymentMethod = pick(["vnpay","vnpay","wallet","momo","bank-card","bank-transfer"]);
      if (paymentMethod === "vnpay") {
        vnpayTxnRef = `VNPBK${Date.now().toString().slice(-8)}${rand(100,999)}`;
        vnpayBankCode = pick(["NCB","VISA","MB","BIDV","VIETCOM","TECH","VP"]);
        vnpayBankTranNo = `BK${rand(10000000,99999999)}`;
        vnpayCardType = pick(["ATM","VISA","MASTERCARD"]);
        vnpayTransactionNo = `${rand(10000000,99999999)}`;
      }
    } else if (paymentStatus === "pending") {
      paymentMethod = pick(["vnpay","bank-transfer","qr-code",""]);
      if (paymentMethod === "vnpay") {
        vnpayTxnRef = `VNPBK${Date.now().toString().slice(-8)}${rand(100,999)}`;
        vnpayBankCode = pick(["NCB","VISA","MB"]);
      }
    }
    bookings.push({
      customerId: cust._id,
      trainerId: trainer._id,
      date,
      time: slot.start,
      startTime: slot.start,
      endTime: slot.end,
      locationId: cust.locationId,
      status,
      price: trainer.pricePerSession || 500000,
      paymentStatus,
      paymentMethod,
      vnpay_txn_ref: vnpayTxnRef,
      vnpay_bank_code: vnpayBankCode,
      vnpay_bank_tran_no: vnpayBankTranNo,
      vnpay_card_type: vnpayCardType,
      vnpay_transaction_no: vnpayTransactionNo,
      createdAt,
      updatedAt: createdAt,
    });
  }
  // Đảm bảo mỗi HLV hôm nay có 1-3 lịch để cột Hoa hồng ở StaffList luôn có số
  const todayStr = new Date().toISOString().slice(0,10);
  const todayDate = new Date(todayStr);
  for (const trainer of trainers) {
    const countToday = Math.random() < 0.3 ? 0 : rand(1, 3);
    for (let k = 0; k < countToday; k++) {
      const cust = pick(customers.filter(c => String(c.locationId) === String(trainer.locationId) && c.status === "approved"));
      if (!cust) continue;
      const slot = pick([
        { start: "06:00", end: "07:30" },
        { start: "09:00", end: "10:30" },
        { start: "15:00", end: "16:30" },
        { start: "18:00", end: "19:30" },
      ]);
      // Tránh trùng giờ đã có
      if (bookings.some(b => String(b.trainerId) === String(trainer._id) && b.date.getTime() === todayDate.getTime() && b.time === slot.start)) continue;
      const todayMethod = pick(["vnpay","wallet","momo","bank-card"]);
      const tvnpayTxnRef = todayMethod === "vnpay" ? `VNPBK${Date.now().toString().slice(-8)}${rand(100,999)}` : "";
      const tvnpayBankCode = todayMethod === "vnpay" ? pick(["NCB","VISA","MB","BIDV"]) : "";
      const tvnpayBankTranNo = todayMethod === "vnpay" ? `BK${rand(10000000,99999999)}` : "";
      const tvnpayCardType = todayMethod === "vnpay" ? pick(["ATM","VISA"]) : "";
      const tvnpayTransactionNo = todayMethod === "vnpay" ? `${rand(10000000,99999999)}` : "";
      bookings.push({
        customerId: cust._id,
        trainerId: trainer._id,
        date: todayDate,
        time: slot.start,
        startTime: slot.start,
        endTime: slot.end,
        locationId: trainer.locationId,
        status: "confirmed",
        price: trainer.pricePerSession || 500000,
        paymentStatus: "paid",
        paymentMethod: todayMethod,
        vnpay_txn_ref: tvnpayTxnRef,
        vnpay_bank_code: tvnpayBankCode,
        vnpay_bank_tran_no: tvnpayBankTranNo,
        vnpay_card_type: tvnpayCardType,
        vnpay_transaction_no: tvnpayTransactionNo,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
  const docs = await Booking.insertMany(bookings);
  console.log(`✅ Bookings: ${docs.length} (500 + hôm nay mỗi HLV 1-3 lịch, pending chỉ trong 24h)`);
  return docs;
}

async function createCheckIns(customers) {
  // FIX: schema hiện tại yêu cầu userPackageId (required) -> map từ UserPackage đã tạo
  const allUps = await UserPackage.find({}).select("_id customer_id").lean();
  const pkgMap = new Map(allUps.map(p => [String(p.customer_id), p._id]));
  const checkins = [];
  const packages = ["Gói 1 Tháng", "Gói 3 Tháng", "Gói 6 Tháng PT", "Gói 12 Tháng Full PT", "Gói VIP 3 Tháng"];
  const trainers = ["HLV Nguyễn Văn A", "HLV Trần Thị B", "HLV Lê Minh C", "Hệ thống tự động ghi nhận"];
  const focusZones = ["Tay - Ngực", "Lưng - Xô", "Chân - Mông", "Core - Bụng", "Cardio", "Toàn thân"];
  const exercisesPool = [
    { name: "Bench Press", sets: 4, reps: "8-12" },
    { name: "Squat", sets: 4, reps: "10-12" },
    { name: "Deadlift", sets: 3, reps: "6-8" },
    { name: "Lat Pulldown", sets: 3, reps: "10-12" },
    { name: "Shoulder Press", sets: 3, reps: "8-10" },
    { name: "Plank", sets: 3, reps: "60s" },
  ];
  const year = new Date().getFullYear();
  const monthsDemo = [3,4,5,6,7,8];
  for (const cust of customers.filter(c => c.status === "approved")) {
    const pkgId = pkgMap.get(String(cust._id)) || new mongoose.Types.ObjectId();
    for (const m of monthsDemo) {
      const daysInMonth = new Date(year, m+1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        if (date > new Date()) continue;
        if (Math.random() < 0.55) continue;
        if (date.getDay() === 0 && Math.random() < 0.3) continue;
        date.setHours(rand(6, 19), rand(0, 59), rand(0, 59), 0);
        const out = new Date(date.getTime() + rand(45, 150)*60000);
        checkins.push({
          customerId: cust._id, locationId: cust.locationId,
          userPackageId: pkgId,
          checkInTime: date,
          checkOutTime: out, status: "checked-out",
          method: pick(["QR_CODE","FACE_ID"]),
          // các field cũ giữ để tương thích FE cũ (strict:false sẽ bỏ qua nếu schema strict)
          packageName: pick(packages), trainerName: pick(trainers), duration: `${rand(45, 90)} phút`,
          focusZone: pick(focusZones), exercises: Array.from({ length: rand(2, 4) }, () => pick(exercisesPool)),
          trainerNotes: pick(["Tập trung tốt", "Tăng tạ 2kg", "Khởi động kỹ hơn", "Hoàn thành xuất sắc"]),
          caloriesBurned: rand(250, 600),
        });
      }
    }
    for (let m = 0; m < 12; m++) {
      if (monthsDemo.includes(m)) continue;
      for (let d = 1; d <= new Date(year, m+1,0).getDate(); d++) {
        if (Math.random() < 0.85) continue;
        const date = new Date(year, m, d); date.setHours(rand(6, 19), rand(0, 59), 0, 0);
        if (date > new Date()) continue;
        checkins.push({
          customerId: cust._id, locationId: cust.locationId,
          userPackageId: pkgId,
          checkInTime: date,
          checkOutTime: new Date(date.getTime()+60*60000), status: "checked-out",
          method: "QR_CODE",
          packageName: pick(packages), trainerName: pick(trainers), duration: "60 phút",
          focusZone: pick(focusZones), exercises: [pick(exercisesPool)], trainerNotes: "Ghi nhận",
        });
      }
    }
  }
  const todayOnly = new Date(); todayOnly.setHours(0,0,0,0);
  for (let i = 0; i < 50; i++) {
    const cust = pick(customers.filter(c => c.status === "approved"));
    const pkgId = pkgMap.get(String(cust._id)) || new mongoose.Types.ObjectId();
    const checkIn = new Date(todayOnly); checkIn.setHours(rand(6, 20), rand(0, 59), rand(0, 59), 0);
    const out = new Date(checkIn.getTime() + rand(60, 180)*60000);
    checkins.push({
      customerId: cust._id,
      locationId: cust.locationId,
      userPackageId: pkgId,
      checkInTime: checkIn,
      checkOutTime: Math.random() > 0.3 ? out : null,
      status: out ? "checked-out" : "success",
      method: pick(["QR_CODE","FACE_ID"]),
      packageName: pick(packages),
      trainerName: pick(trainers),
      duration: `${rand(45, 90)} phút`,
      focusZone: pick(focusZones),
      exercises: [pick(exercisesPool), pick(exercisesPool)],
      trainerNotes: "Hôm nay - quét FaceID thành công.",
    });
  }
  const docs = await CheckIn.insertMany(checkins);
  console.log(`✅ CheckIns: ${docs.length} (chi tiết cho Progress - 5 tuần, ~1000 lượt)`);
  return docs;
}

async function createStaffShifts(staff) {
  const shifts = [];
  // Tạo dày cho tháng 4-9 để demo, các tháng khác thưa hơn
  const year = new Date().getFullYear();
  const monthsDemo = [3,4,5,6,7,8]; // 4,5,6,7,8,9 (0-based)
  for (const s of staff) {
    if (s.status !== "active") continue;
    for (let m of monthsDemo) {
      const daysInMonth = new Date(year, m+1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d); date.setHours(0,0,0,0);
        if (date > new Date()) continue;
        if (Math.random() < 0.1) continue;
        if (date.getDay() === 0 && Math.random() < 0.2) continue;
        const sh = pick(["morning-noon","afternoon-evening"]);
        shifts.push({ staffId: s._id, date, shift: sh, locationId: s.locationId });
        if (Math.random() < 0.45) {
          const other = sh === "morning-noon" ? "afternoon-evening" : "morning-noon";
          shifts.push({ staffId: s._id, date, shift: other, locationId: s.locationId });
        }
      }
    }
    // Các tháng còn lại thưa
    for (let m = 0; m < 12; m++) {
      if (monthsDemo.includes(m)) continue;
      for (let d = 1; d <= new Date(year, m+1,0).getDate(); d++) {
        if (Math.random() < 0.7) continue;
        const date = new Date(year, m, d); date.setHours(0,0,0,0);
        if (date > new Date()) continue;
        shifts.push({ staffId: s._id, date, shift: pick(["morning-noon","afternoon-evening"]), locationId: s.locationId });
      }
    }
  }
  const uniq = new Map();
  for (const s of shifts) {
    const key = `${s.staffId}-${s.date.toISOString().slice(0,10)}-${s.shift}`;
    if (!uniq.has(key)) uniq.set(key, s);
  }
  const docs = await StaffShift.insertMany([...uniq.values()]);
  console.log(`✅ StaffShifts: ${docs.length} (dày T4-9, thưa các tháng khác)`);
  return docs;
}

async function createStaffAttendance(staff) {
  const atts = [];
  const year = new Date().getFullYear();
  const monthsDemo = [3,4,5,6,7,8];
  const attMap = new Map(); // unique (staffId, date) theo schema - trùng thì gộp giờ ra
  const pushAtt = (rec) => {
    const key = `${rec.staffId}-${rec.date.toISOString().slice(0, 10)}`;
    const prev = attMap.get(key);
    if (!prev) { attMap.set(key, rec); return; }
    if (rec.checkInTime && (!prev.checkInTime || rec.checkInTime < prev.checkInTime)) prev.checkInTime = rec.checkInTime;
    if (rec.checkOutTime && (!prev.checkOutTime || rec.checkOutTime > prev.checkOutTime)) {
      prev.checkOutTime = rec.checkOutTime;
      if (prev.status === "checked-in") prev.status = rec.status || "checked-out";
    }
    prev.minutesLate = Math.max(prev.minutesLate || 0, rec.minutesLate || 0);
  };
  for (const s of staff) {
    if (s.status !== "active") continue;
    for (const m of monthsDemo) {
      const daysInMonth = new Date(year, m+1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d); date.setHours(0,0,0,0);
        if (date > new Date()) continue;
        if (Math.random() < 0.15) continue;
        if (date.getDay() === 0 && Math.random() < 0.2) continue;
        const checkIn = new Date(date); checkIn.setHours(rand(5, 8), rand(0, 59), 0, 0);
        const checkOut = new Date(checkIn.getTime() + rand(6, 9)*3600*1000 + rand(0, 59)*60000);
        const hasOut = Math.random() > 0.15;
        pushAtt({
          staffId: s._id, date, checkInTime: checkIn, checkOutTime: hasOut ? checkOut : null, locationId: s.locationId,
          status: hasOut ? (Math.random() > 0.85 ? "late" : "checked-out") : "checked-in",
          minutesLate: rand(0, 20),
        });
        if (Math.random() > 0.6) {
          const checkIn2 = new Date(date); checkIn2.setHours(13, rand(30, 59), 0, 0);
          const checkOut2 = new Date(checkIn2.getTime() + rand(5, 7)*3600*1000);
          pushAtt({ staffId: s._id, date, checkInTime: checkIn2, checkOutTime: Math.random() > 0.3 ? checkOut2 : null, locationId: s.locationId, status: "checked-in", minutesLate: rand(0, 10) });
        }
      }
    }
    // Các tháng khác thưa
    for (let m = 0; m < 12; m++) {
      if (monthsDemo.includes(m)) continue;
      for (let d = 1; d <= new Date(year,m+1,0).getDate(); d++) {
        if (Math.random() < 0.75) continue;
        const date = new Date(year, m, d); date.setHours(0,0,0,0);
        if (date > new Date()) continue;
        const checkIn = new Date(date); checkIn.setHours(rand(5, 8), rand(0, 59), 0, 0);
        pushAtt({ staffId: s._id, date, checkInTime: checkIn, checkOutTime: new Date(checkIn.getTime()+7*3600*1000), locationId: s.locationId, status: "checked-out", minutesLate: rand(0, 15) });
      }
    }
  }
  const docs = await StaffAttendance.insertMany([...attMap.values()]);
  console.log(`✅ StaffAttendance: ${docs.length} (dày T4-9, thưa các tháng khác)`);
  return docs;
}

async function createLockers(locs, customers, staff) {
  const lockers = [];
  for (const loc of locs) {
    for (let i = 1; i <= 30; i++) {
      const prefix = i <= 15 ? "A" : "B";
      const num = `${prefix}-${String(i).padStart(3,"0")}`;
      const isOccupied = Math.random() < 0.3;
      let assignedType = null, assignedName = "", assignedPhone = "";
      if (isOccupied) {
        if (Math.random() > 0.5) {
          const c = pick(customers.filter(c => String(c.locationId) === String(loc._id)));
          assignedType = "MEMBER"; assignedName = c.fullName; assignedPhone = c.phone;
        } else {
          const s = pick(staff.filter(s => String(s.locationId) === String(loc._id)));
          assignedType = "STAFF"; assignedName = s.fullName; assignedPhone = s.phone;
        }
      }
      lockers.push({
        lockerNumber: num,
        prefix,
        locationId: loc._id,
        zone: i % 2 === 0 ? "NAM" : "NU",
        status: isOccupied ? "OCCUPIED" : "AVAILABLE",
        assignedType,
        assignedName,
        assignedPhone,
      });
    }
  }
  const docs = await LockerV2.insertMany(lockers);
  console.log(`✅ Lockers: ${docs.length}`);
  return docs;
}

async function createEquipmentAndProducts(locs) {
  // Đảm bảo mỗi thiết bị gắn đúng CLB (location_id) theo yêu cầu chuỗi phòng tập
  // Luôn đảm bảo 75 máy chuẩn cho đa máy - chạy lại sẽ tự vá, không để trống
  const existingEqCount = await Equipment.countDocuments();
  if (existingEqCount > 0 && !CLEAN) {
    // Kiểm tra có thiếu location_id hoặc warranty 30d không
    const missing = await Equipment.countDocuments({ location_id: { $exists: false } });
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const allForCheck = await Equipment.find({}).select("purchase_date warranty_period");
    let warrantyOk = 0;
    for (const eq of allForCheck) {
      const pd = new Date(eq.purchase_date || eq.createdAt);
      const wed = new Date(pd); wed.setMonth(wed.getMonth() + (Number(eq.warranty_period)||0));
      if (wed >= now && wed <= thirtyDaysFromNow) warrantyOk++;
    }
    if (missing === 0 && warrantyOk >= 8 && existingEqCount === 75) {
      console.log(`✅ Equipment đã có sẵn ${existingEqCount} (đủ location_id, warranty ${warrantyOk}/8), bỏ qua - xóa tay hoặc dùng --clean để tạo lại`);
      // Vẫn đảm bảo product đủ
      const prodCount = await Product.countDocuments();
      if (prodCount >= 45) return;
    }
    if (missing > 0 || warrantyOk < 8 || existingEqCount !== 75) {
      console.log(`⚠️ Equipment hiện ${existingEqCount}, thiếu location_id=${missing}, warranty 30d=${warrantyOk}/8 -> xóa và tạo lại 75 máy chuẩn cho đa máy...`);
      await Equipment.deleteMany({});
      await Product.deleteMany({});
    }
  } else if (existingEqCount > 0 && CLEAN) {
    // clean() đã xóa, không cần xóa lại
  }
  const equips = [];
  const products = [];
  const purchasers = ["Nguyễn Văn An","Trần Thị Bình","Lê Văn Cường","Phạm Thị Dung","Hoàng Văn Dũng"];
  const addresses = ["123 Lê Lợi, Quận 1, TP.HCM","456 Nguyễn Trãi, Quận 7, TP.HCM","789 Điện Biên Phủ, Bình Thạnh, TP.HCM"];
  for (const loc of locs) {
    for (let i = 0; i < 25; i++) {
      const qty = rand(2, 10);
      const unitPrice = rand(3, 15) * 1000000;
      let warranty_period = pick([12, 24, 36]);
      let purchaseDate;
      let status;
      // Phân bổ đều theo từng CLB để khi đổi CLB, cảnh báo thay đổi (3 warranty + 2 hỏng/CLB)
      if (i < 3) {
        const daysToExpiry = rand(5, 25);
        purchaseDate = new Date();
        purchaseDate.setMonth(purchaseDate.getMonth() - warranty_period);
        purchaseDate.setDate(purchaseDate.getDate() + daysToExpiry);
        status = "hoạt động";
      } else if (i < 5) {
        purchaseDate = new Date(Date.now() - rand(10, 200) * 24 * 3600 * 1000);
        status = "hỏng hóc";
      } else {
        purchaseDate = new Date(Date.now() - rand(10, 300) * 24 * 3600 * 1000);
        status = pick(["hoạt động","hoạt động","hoạt động","bảo trì","hỏng hóc","thiếu linh kiện"]);
      }
      let reports = [];
      if (i < 3) {
        reports = [];
      } else if (i < 5) {
        reports = [{
          statusType: "hỏng hóc",
          affectedQuantity: rand(1, Math.min(3, qty)),
          reason: pick(["Đứt cáp ròng rọc","Hao mòn bạc đạn","Cần bảo trì định kỳ","Thiếu linh kiện thay thế"]),
          reportedAt: new Date(Date.now() - rand(8, 12) * 24 * 3600 * 1000),
          status: "pending",
          cost: 0,
          downtime_days: 0,
        }];
      } else if (Math.random() > 0.6) {
        reports = [{
          statusType: status === "hoạt động" ? "bảo trì" : status,
          affectedQuantity: rand(1, Math.min(3, qty)),
          reason: pick(["Đứt cáp ròng rọc","Hao mòn bạc đạn","Cần bảo trì định kỳ","Thiếu linh kiện thay thế"]),
          reportedAt: new Date(Date.now() - rand(1, 10) * 24 * 3600 * 1000),
          status: pick(["pending","pending","resolved"]),
          cost: 0,
          downtime_days: 0,
        }];
      }
      equips.push({
        name: `Máy ${pick(["Chạy bộ","Tập tạ","Đạp xe","Ép ngực","Xà đơn","Tạ đơn","Smith Machine","Leg Press"])} ${i + 1} - ${loc.title}`,
        quantity: qty,
        unitPrice,
        total: qty * unitPrice,
        status,
        supplier: pick(["Công ty TNHH Thiết bị Gym","CTY Fitness Pro","Nhà cung cấp VN Gym"]),
        phone: `090${String(rand(1000000, 9999999)).padStart(7,"0")}`,
        address: pick(addresses),
        purchaser: pick(purchasers),
        description: `Thiết bị ${loc.title} - nhập ${purchaseDate.toLocaleDateString("vi-VN")}`,
        purchase_date: purchaseDate,
        warranty_period,
        maintenance_cycle_months: pick([3, 6, 12]),
        last_maintenance_date: new Date(Date.now() - rand(0, 30) * 24 * 3600 * 1000),
        total_maintenance_cost: rand(0, 8) * 500000,
        total_downtime_days: rand(0, 12),
        location_id: loc._id,
        image_url: "",
        invoice_url: "",
        warranty_card_url: "",
        reports,
      });
    }
    for (let i = 0; i < 15; i++) {
      const prodPrice = rand(3, 20) * 100000;
      const prodSold = rand(0, 50);
      // Doanh số theo tháng (để thống kê tài chính có doanh thu SP + COGS + chi tiết shop)
      const monthlySales = [];
      if (prodSold > 0) {
        const nowY = new Date().getFullYear();
        const curM = new Date().getMonth() + 1;
        const weights = Array.from({ length: curM }, () => Math.random() + 0.2);
        const wSum = weights.reduce((a, b) => a + b, 0);
        let assigned = 0;
        for (let m = 1; m <= curM; m++) {
          const qty = m === curM ? prodSold - assigned : Math.floor((weights[m - 1] / wSum) * prodSold);
          assigned += qty;
          if (qty > 0) monthlySales.push({ month: m, year: nowY, quantity: qty, revenue: qty * prodPrice });
        }
      }
      products.push({
        name: `${pick(["Whey Protein","BCAA","Creatine","Vitamin","Pre-Workout","Mass Gainer"])} ${pick(["Gold","Premium","Pro","Elite"])} ${i + 1}`,
        price: prodPrice,
        costPrice: rand(2, 10) * 100000,
        quantity: rand(5, 150),
        importQuantity: rand(20, 200),
        sold: prodSold,
        monthlySales,
        location_id: loc._id,
        importDate: new Date(Date.now() - rand(0, 60) * 24 * 3600 * 1000),
        expiryDate: new Date(Date.now() + rand(180, 720) * 24 * 3600 * 1000),
      });
    }
  }
  if (equips.length) await Equipment.insertMany(equips);
  if (products.length) await Product.insertMany(products);
  console.log(`✅ Equipment: ${equips.length} (25/CLB, mỗi thiết bị có location_id), Products: ${products.length} (15/CLB)`);
}

async function createServices(locs) {
  const serviceNames = ["Tư vấn dinh dưỡng", "Đo chỉ số cơ thể", "Tập thử miễn phí", "Gói PT 1-1", "Lớp Yoga", "Lớp Boxing", "Xông hơi", "Massage hồi phục"];
  const services = [];
  for (const loc of locs) {
    for (const name of serviceNames) {
      services.push({
        name,
        description: `Dịch vụ ${name} tại ${loc.title}`,
        location_id: loc._id,
        images: [],
        is_active: true,
      });
    }
  }
  // Service model uses location_id, try both field names for compatibility
  try {
    const docs = await Service.insertMany(services);
    console.log(`✅ Services: ${docs.length} (8/CLB)`);
    return docs;
  } catch (e) {
    // Fallback: try with locationId field
    const alt = services.map(s => ({ name: s.name, description: s.description, locationId: s.location_id, images: [] }));
    const docs = await Service.insertMany(alt);
    console.log(`✅ Services: ${docs.length} (8/CLB)`);
    return docs;
  }
}

async function createExpenses(locs) {
  const exps = [];
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();
  for (const loc of locs) {
    // Mỗi tháng 4-6 khoản chi để biểu đồ chi phí cả năm đầy
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(startOfYear); monthDate.setMonth(m);
      if (monthDate > now) break;
      const count = rand(4, 6);
      for (let i = 0; i < count; i++) {
        const d = new Date(monthDate); d.setDate(rand(1, 28));
        if (d > now) continue;
        const expName = pick(["Tiền điện","Tiền nước","Thuế","Sửa máy","Mua tạ mới","Marketing"]);
        exps.push({
          name: `${expName} - ${loc.title} T${m+1}`,
          category: pick(["equipment","utilities","tax","other"]),
          description: `${expName} - ${loc.title} T${m+1}`,
          amount: rand(2, 10)*1000000,
          date: d,
          locationId: loc._id,
        });
      }
    }
  }
  await Expense.insertMany(exps);
  console.log(`✅ Expenses: ${exps.length} (4-6/tháng/CLB, cả năm)`);
}

async function createArticles(locs) {
  const cats = ["tin-tuc","meo-tap","dinh-duong","su-kien"];
  const titles = ["5 Mẹo Tăng Cơ Nhanh", "Chế Độ Ăn Cho Người Tập Gym", "Khai Trương Chi Nhánh Mới", "Yoga Giúp Giảm Căng Thẳng", "Whey Protein Có Tốt Không?"];
  const arts = [];
  for (const loc of locs) {
    for (let i = 0; i < 8; i++) {
      const cat = pick(cats);
      arts.push({
        title: `${pick(titles)} - ${loc.title} ${i+1}`,
        excerpt: `Bài viết mẫu về ${cat} tại ${loc.title}`,
        content: `Nội dung chi tiết bài viết ${cat} mẫu cho ${loc.title}. Đây là dữ liệu demo để trang tin tức hiển thị đầy đặn.`,
        image: "https://images.unsplash.com/photo-1534438327276-e40034ed64e6?auto=format&fit=crop&q=80&w=800",
        category: cat,
        status: pick(["published","published","published","draft"]),
        views: rand(50, 500),
        publishedAt: new Date(Date.now() - rand(0, 30)*24*3600*1000),
      });
    }
  }
  const docs = await Article.insertMany(arts);
  console.log(`✅ Articles: ${docs.length} (tin tức)`);
  return docs;
}

async function createServiceRequests(customers, locs) {
  const types = ["freeze","activate","transfer","cancel-refund","locker","complaint","support","contract"];
  const reqs = [];
  for (let i = 0; i < 60; i++) {
    const cust = pick(customers);
    const loc = locs.find(l => String(l._id) === String(cust.locationId)) || pick(locs);
    const payment_status = pick(["unpaid","paid","paid"]);
    const fee = rand(0, 5)*100000;
    // FIX history: bổ sung payment_method để cột Phương thức không trống (khi /dashboard/history merge serviceRequests)
    const payment_method = fee === 0 ? "" : payment_status === "paid"
      ? pick(["vnpay","wallet","momo","bank-transfer","qr-code"])
      : pick(["vnpay","bank-transfer","qr-code",""]);
    const vnpayTxnRef = payment_method === "vnpay" ? `VNPSR${Date.now().toString().slice(-8)}${rand(100,999)}` : "";
    const vnpayBankCode = payment_method === "vnpay" ? pick(["NCB","VISA","MB","BIDV","VIETCOM"]) : "";
    reqs.push({
      customer_id: cust._id,
      customer_name: cust.fullName,
      customer_phone: cust.phone,
      service_type: pick(types),
      description: `Yêu cầu dịch vụ mẫu ${i+1} - ${cust.fullName}`,
      data: { note: "Dữ liệu mẫu" },
      location_id: loc._id,
      status: pick(["pending","pending","awaiting_payment","accepted","rejected"]),
      amount: fee,
      payment_status,
      payment_method,
      vnpay_txn_ref: vnpayTxnRef,
      vnpay_bank_code: vnpayBankCode,
      vnpay_transaction_no: (payment_method === "vnpay" && payment_status === "paid") ? `${rand(10000000,99999999)}` : "",
      paid_at: payment_status === "paid" ? new Date(Date.now() - rand(0,10)*24*3600*1000) : null,
    });
  }
  const docs = await ServiceRequest.insertMany(reqs);
  console.log(`✅ ServiceRequests: ${docs.length} (dịch vụ) | đã bổ sung payment_method`);
  return docs;
}

async function createRecruitments(locs) {
  const positions = ["Lễ tân", "Huấn luyện viên", "Kế toán", "Quản lý"];
  const realNames = [
    "Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường", "Phạm Thị Dung", "Hoàng Văn Dũng", "Vũ Thị Hà", "Đặng Văn Hào", "Bùi Thị Hương",
    "Đỗ Văn Khánh", "Hồ Thị Linh", "Ngô Văn Minh", "Phan Thị Ngọc", "Trịnh Văn Phong", "Lý Thị Thảo", "Đinh Văn Quân", "Võ Thị Uyên",
    "Bùi Văn Việt", "Nguyễn Thị Tùng", "Trần Văn Hải", "Lê Thị Nam"
  ];
  const recs = [];
  for (let i = 0; i < 20; i++) {
    const fullName = realNames[i % realNames.length];
    recs.push({
      fullName,
      email: `${fullName.toLowerCase().replace(/\s+/g,'')}${i+1}@gmail.com`,
      phone: `090${rand(1000000,9999999)}`,
      position: pick(positions),
      description: `Ứng viên ${fullName} ứng tuyển vị trí ${pick(positions)}`,
      status: pick(["Chờ xử lý","Hẹn phỏng vấn","Đã duyệt","Từ chối"]),
      createdAt: new Date(Date.now() - rand(0, 30)*24*3600*1000),
    });
  }
  const docs = await Recruitment.insertMany(recs);
  console.log(`✅ Recruitments: ${docs.length} (tuyển dụng - tên thật)`);
  return docs;
}

async function createWalletTransactions(customers, staff) {
  const txs = [];
  // FIX history: đảm bảo MỌI hội viên đều có lịch sử ví để cột "Số dư sau GD" không trống
  // và bổ sung phương thức (vnpay cho topup, wallet cho payment) + chi tiết VNPay cho cột Ngân hàng
  for (const cust of customers) {
    const topupCount = rand(1, 4);
    let balance = 0;
    for (let i = 0; i < topupCount; i++) {
      const amount = rand(5, 25)*100000;
      const before = balance;
      balance += amount;
      const topupTime = new Date(Date.now() - rand(0, 25)*24*3600*1000 - rand(0, 12)*3600*1000);
      const bankCode = pick(["NCB","VISA","MB","BIDV","VIETCOM","TECH","VP","ACB","VIB"]);
      const cardType = pick(["ATM","VISA","MASTERCARD"]);
      const txnRef = `VNPW${String(cust._id).slice(-6).toUpperCase()}${topupTime.getTime().toString().slice(-8)}${rand(10,99)}`;
      txs.push({
        customerId: cust._id,
        locationId: cust.locationId,
        type: "topup",
        amount,
        balanceBefore: before,
        balanceAfter: balance,
        status: "completed",
        description: `Nạp ví qua VNPay ${amount.toLocaleString('vi-VN')}đ`,
        vnpayTxnRef: txnRef,
        vnpayTransactionNo: `${rand(10000000,99999999)}`,
        vnpayBankCode: bankCode,
        vnpayBankTranNo: `TR${rand(100000000,999999999)}`,
        vnpayCardType: cardType,
        vnpayPayDate: topupTime.toISOString().replace(/[-:T.]/g,"").slice(0,14),
        createdAt: topupTime,
        updatedAt: topupTime,
      });
      // 70% sinh thêm 1 giao dịch thanh toán ví ngay sau nạp để số dư giảm, giúp demo chi/thu rõ ràng
      if (Math.random() < 0.7 && balance > 200000) {
        const maxPay = Math.min(balance, rand(2, 12)*100000);
        const pay = Math.max(100000, maxPay);
        const payBefore = balance;
        balance -= pay;
        const payTime = new Date(topupTime.getTime() + rand(5, 120)*60000); // sau nạp 5-120 phút
        // 50% thanh toán gói tập, 30% thanh toán đặt lịch HLV, 20% phí dịch vụ
        const payDesc = pick([
          `Thanh toán gói tập ${pay.toLocaleString('vi-VN')}đ`,
          `Thanh toán đặt lịch HLV ${pay.toLocaleString('vi-VN')}đ`,
          `Thanh toán phí dịch vụ ${pay.toLocaleString('vi-VN')}đ`,
        ]);
        txs.push({
          customerId: cust._id,
          locationId: cust.locationId,
          type: "payment",
          amount: pay,
          balanceBefore: payBefore,
          balanceAfter: balance,
          status: "completed",
          description: payDesc,
          createdAt: payTime,
          updatedAt: payTime,
        });
      }
    }
    // đảm bảo không âm
    balance = Math.max(0, balance);
    await Customer.findByIdAndUpdate(cust._id, { balance });
  }
  for (const s of staff.slice(0, 30)) {
    if (Math.random() < 0.5) continue;
    const amount = rand(1, 5)*100000;
    txs.push({
      staffId: s._id,
      type: "payment",
      amount,
      balanceBefore: 0,
      balanceAfter: amount,
      status: "completed",
      description: `Hoa hồng ${amount.toLocaleString('vi-VN')}đ`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  const docs = await WalletTransaction.insertMany(txs);
  console.log(`✅ WalletTransactions: ${docs.length} (ví + lịch sử giao dịch) | FIX: 100% hội viên có balanceBefore/After + VNPay cho topup, payment qua ví`);
  // Cập nhật balance cho Staff có ví
  for (const s of staff) {
    const staffTxs = txs.filter(t => String(t.staffId) === String(s._id));
    if (staffTxs.length) {
      const bal = staffTxs.reduce((sum, t) => sum + t.amount, 0);
      await Staff.findByIdAndUpdate(s._id, { balance: bal });
    }
  }
  return docs;
}

async function main() {
  await connect();
  await clean();
  const locs = await createLocations();
  const disciplines = await createDisciplines(locs);
  const jobs = await createJobs();
  await ensureAdminAccount(locs, jobs);
  const staff = await createStaff(locs, jobs, disciplines);
  const customers = await createCustomers(locs);
  const packages = await createPackages(locs, disciplines);
  await createUserPackages(customers, packages);
  await createBookings(customers, staff);
  await createCheckIns(customers);
  await createStaffShifts(staff);
  await createStaffAttendance(staff);
  await createLockers(locs, customers, staff);
  await createEquipmentAndProducts(locs);
  await createServices(locs);
  await createExpenses(locs);
  await createArticles(locs);
  await createServiceRequests(customers, locs);
  await createRecruitments(locs);
  await createWalletTransactions(customers, staff);
  console.log("\n🎉 Demo data SIÊU NHIỀU cho 3 CLB: 100 hội viên, 60 HLV/NV, 24 gói (8/CLB), ~300 UserPackage, 500 booking, 800 check-in, ~1500 ca, ~900 chấm công!");
  console.log("Tất cả mật khẩu: 123123 (riêng admin: admin / admin123)");
  console.log("Quản trị: admin / admin123 (isAdmin=true, mỗi thiết bị có location_id theo CLB)");
  console.log("Hội viên: member_quan1_1 / 123123 (34 TK), member_quan7_1 / 123123 (33 TK), member_binhthanh_1 / 123123 (33 TK)");
  console.log("Nhân viên: staff_quan1_quanly_1 / 123123 (QL), staff_quan1_letan_1 / 123123 (LT), staff_quan1_huanluyenvien_1..16 / 123123 (HLV)");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
