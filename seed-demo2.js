import "dotenv/config";
import mongoose from "mongoose";
import Equipment from "./models/schemas/equipmentSchema.js";
import Location from "./models/schemas/locationSchema.js";
import Customer from "./models/schemas/customerSchema.js";
import Staff from "./models/schemas/staffSchema.js";
import UserPackage from "./models/schemas/userPackageSchema.js";
import Package from "./models/schemas/packageSchema.js";
import CheckIn from "./models/schemas/checkInSchema.js";
import StaffAttendance from "./models/schemas/staffAttendanceSchema.js";
import StaffShift from "./models/schemas/staffShiftSchema.js";
import { LockerV2 } from "./models/lockerManagementModel.js";
import ServiceRequest from "./models/schemas/serviceRequestSchema.js";

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/gymmanager";
const CLEAN_ARG = process.argv.includes("--clean");

const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = (arr) => arr[rand(0, arr.length-1)];

async function seedEquipment() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Kết nối", mongoose.connection.name);

  const locs = await Location.find({});
  if (locs.length === 0) {
    console.error("❌ Chưa có CLB nào. Hãy chạy node seed-demo.js trước để tạo CLB.");
    process.exit(1);
  }
  console.log(`📌 Tìm thấy ${locs.length} CLB: ${locs.map(l=>l.title).join(", ")}`);

  let needCreateEquipment = true;
  const existing = await Equipment.countDocuments();
  if (existing > 0) {
    if (CLEAN_ARG) {
      await Equipment.deleteMany({});
      console.log(`🧹 Đã xóa ${existing} thiết bị cũ (--clean)`);
    } else {
      const missing = await Equipment.countDocuments({ location_id: { $exists: false } });
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30*24*3600*1000);
      const all = await Equipment.find({}).select("purchase_date warranty_period");
      let warrantyOk = 0;
      for (const eq of all) {
        const pd = new Date(eq.purchase_date || eq.createdAt);
        const wed = new Date(pd); wed.setMonth(wed.getMonth() + (Number(eq.warranty_period)||0));
        if (wed >= now && wed <= thirtyDaysFromNow) warrantyOk++;
      }
      if (missing===0 && warrantyOk>=8 && existing===75) {
        console.log(`✅ Đã có sẵn ${existing} thiết bị đủ location_id và warranty ${warrantyOk}/8, bỏ qua tạo thiết bị`);
        needCreateEquipment = false;
      } else {
        console.log(`⚠️ Phát hiện thiếu: location_id thiếu=${missing}, warranty 30d=${warrantyOk}/8 -> xóa và tạo lại 75 máy chuẩn...`);
        await Equipment.deleteMany({});
      }
    }
  }

  if (needCreateEquipment) {
    const purchasers = ["Nguyễn Văn An","Trần Thị Bình","Lê Văn Cường","Phạm Thị Dung","Hoàng Văn Dũng"];
    const addresses = ["123 Lê Lợi, Quận 1, TP.HCM","456 Nguyễn Trãi, Quận 7, TP.HCM","789 Điện Biên Phủ, Bình Thạnh, TP.HCM"];
    const equips = [];
    for (const loc of locs) {
      for (let i=0;i<25;i++) {
        const qty = rand(3,25);
        const unitPrice = rand(5,30)*1000000;
        let warranty_period = pick([12,24,36]);
        let purchaseDate;
        let status;
        // Phân bổ đều theo từng CLB để khi đổi CLB, cảnh báo thay đổi
        if (i < 3) {
          const daysToExpiry = rand(5,25);
          purchaseDate = new Date();
          purchaseDate.setMonth(purchaseDate.getMonth() - warranty_period);
          purchaseDate.setDate(purchaseDate.getDate() + daysToExpiry);
          status = "hoạt động";
        } else if (i < 5) {
          purchaseDate = new Date(Date.now() - rand(10,200)*24*3600*1000);
          status = "hỏng hóc";
        } else {
          purchaseDate = new Date(Date.now() - rand(10,300)*24*3600*1000);
          status = pick(["hoạt động","hoạt động","hoạt động","bảo trì","hỏng hóc","thiếu linh kiện"]);
        }
        let reports = [];
        if (i < 3) reports = [];
        else if (i < 5) reports = [{
          statusType: "hỏng hóc",
          affectedQuantity: rand(1, Math.min(3, qty)),
          reason: pick(["Đứt cáp ròng rọc","Hao mòn bạc đạn","Cần bảo trì định kỳ","Thiếu linh kiện thay thế"]),
          reportedAt: new Date(Date.now() - rand(8,12)*24*3600*1000),
          status: "pending",
          cost: 0, downtime_days: 0,
        }];
        else if (Math.random() > 0.6) reports = [{
          statusType: status==="hoạt động"?"bảo trì":status,
          affectedQuantity: rand(1, Math.min(3, qty)),
          reason: pick(["Đứt cáp ròng rọc","Hao mòn bạc đạn","Cần bảo trì định kỳ","Thiếu linh kiện thay thế"]),
          reportedAt: new Date(Date.now() - rand(1,10)*24*3600*1000),
          status: pick(["pending","pending","resolved"]),
          cost: 0, downtime_days: 0,
        }];
        equips.push({
          name: `Máy ${pick(["Chạy bộ","Tập tạ","Đạp xe","Ép ngực","Xà đơn","Tạ đơn","Smith Machine","Leg Press"])} ${i+1} - ${loc.title}`,
          quantity: qty, unitPrice, total: qty*unitPrice, status,
          supplier: pick(["Công ty TNHH Thiết bị Gym","CTY Fitness Pro","Nhà cung cấp VN Gym"]),
          phone: `090${String(rand(1000000,9999999)).padStart(7,"0")}`,
          address: pick(addresses), purchaser: pick(purchasers),
          description: `Thiết bị ${loc.title} - nhập ${purchaseDate.toLocaleDateString("vi-VN")}`,
          purchase_date: purchaseDate, warranty_period,
          maintenance_cycle_months: pick([3,6,12]),
          last_maintenance_date: new Date(Date.now() - rand(0,30)*24*3600*1000),
          total_maintenance_cost: rand(0,8)*500000,
          total_downtime_days: rand(0,12),
          location_id: loc._id, image_url:"", invoice_url:"", warranty_card_url:"", reports,
        });
      }
    }

    const docs = await Equipment.insertMany(equips);
    console.log(`✅ Đã tạo ${docs.length} thiết bị (25/CLB, mỗi máy có location_id)`);
    for (const loc of locs) {
      const c = await Equipment.countDocuments({ location_id: loc._id });
      console.log(`   - ${loc.title}: ${c}`);
    }
    // kiểm tra cảnh báo
    const now=new Date(), thirtyDaysFromNow=new Date(now.getTime()+30*86400000);
    let warrantyOk=0;
    for(const eq of docs){
      const wed=new Date(eq.purchase_date); wed.setMonth(wed.getMonth()+eq.warranty_period);
      if(wed>=now && wed<=thirtyDaysFromNow) warrantyOk++;
    }
    console.log(`📌 Trong 30 ngày tới hết hạn: ${warrantyOk}/8 máy (đủ cho ô Cảnh báo Bảo hành)`);
  }

  const customers = await Customer.find({ status: "approved" });
  const staffList = await Staff.find({ status: "active" });

  // ---- Tạo tủ đồ per CLB: 2 dãy (NAM/NU), mỗi dãy 10-16 tủ với mã LK/LC/LD/LR, đủ 4 trạng thái ----
  console.log("📌 Đang tạo tủ đồ per CLB (2 dãy NAM/NU, 10-16 tủ/dãy, mã LK/LC/LD/LR)...");
  if (CLEAN_ARG) await LockerV2.deleteMany({});
  let lockerCount = await LockerV2.countDocuments();
  // kiểm tra thiếu trạng thái bảo trì/ chờ trả chìa / thuê và thiếu thời gian
  const hasMaintenance = await LockerV2.countDocuments({ status:"MAINTENANCE" });
  const hasAwait = await LockerV2.countDocuments({ status:"AWAIT_KEY_RETURN" });
  const hasTime = await LockerV2.countDocuments({ status:"OCCUPIED", assignedAt: { $ne: null } });
  let allLockers = [];
  if (lockerCount === 0 || hasMaintenance===0 || hasAwait===0 || hasTime===0) {
    if (lockerCount>0) {
      await LockerV2.deleteMany({});
      console.log(`⚠️ Locker thiếu trạng thái/thời gian (maintenance:${hasMaintenance}, await:${hasAwait}, time:${hasTime}) -> xóa và tạo lại...`);
    }
    const lockers = [];
    const prefixes = ["LK","LC","LD","LR"];
    for (const loc of locs) {
      for (const zone of ["NAM","NU"]) {
        const perZone = rand(10,16);
        for (let i=0;i<perZone;i++) {
          const prefix = pick(prefixes);
          const baseNum = zone==="NAM" ? i+1 : i+17;
          const lockerNumber = `${prefix}-${String(baseNum).padStart(3,"0")}`;
          // phân bổ 4 trạng thái: 40% AVAILABLE, 30% OCCUPIED, 15% MAINTENANCE, 15% AWAIT_KEY_RETURN
          const r = Math.random();
          let status, assignedType=null, assignedName="", assignedPhone="", assignedAt=null, rentedAt=null, rentalDays=0, maintenanceAt=null, maintenanceType="", previousStatus=null;
          if (r < 0.4) {
            status = "AVAILABLE";
          } else if (r < 0.7) {
            status = "OCCUPIED";
            const daysAgo = rand(1,15);
            assignedAt = new Date(Date.now() - daysAgo*24*3600*1000);
            rentedAt = new Date(assignedAt);
            rentalDays = pick([7,15,30]);
            if (Math.random()>0.5) {
              const c = pick(customers.filter(c=> String(c.locationId)===String(loc._id)));
              if (c) { assignedType="MEMBER"; assignedName=c.fullName; assignedPhone=c.phone; }
            } else {
              const s = pick(staffList.filter(s=> String(s.locationId)===String(loc._id)));
              if (s) { assignedType="STAFF"; assignedName=s.fullName; assignedPhone=s.phone; }
            }
          } else if (r < 0.85) {
            status = "MAINTENANCE";
            previousStatus = pick(["AVAILABLE","OCCUPIED"]);
            maintenanceAt = new Date(Date.now() - rand(1,7)*24*3600*1000);
            maintenanceType = pick(["vệ sinh","sửa khóa","sơn","thay bản lề"]);
          } else {
            status = "AWAIT_KEY_RETURN";
            const daysAgo = rand(15,30);
            assignedAt = new Date(Date.now() - daysAgo*24*3600*1000);
            rentedAt = new Date(assignedAt);
            rentalDays = pick([7,15]);
            previousStatus = "OCCUPIED";
            const c = pick(customers.filter(c=> String(c.locationId)===String(loc._id)));
            if (c) { assignedType="MEMBER"; assignedName=c.fullName; assignedPhone=c.phone; }
          }
          lockers.push({
            lockerNumber, prefix, locationId: loc._id, zone, status, previousStatus,
            assignedType, assignedName, assignedPhone, assignedAt, rentedAt, rentalDays,
            maintenanceAt, maintenanceType,
            maintenanceDescription: status==="MAINTENANCE" ? `Bảo trì ${maintenanceType} tủ ${lockerNumber}` : "",
          });
        }
      }
    }
    if (lockers.length) {
      await LockerV2.insertMany(lockers);
      console.log(`✅ Locker: ${lockers.length} tủ (per CLB 20-32, 2 dãy NAM/NU, mã LK/LC/LD/LR, đủ 4 trạng thái)` );
      for (const loc of locs) {
        const c = await LockerV2.countDocuments({ locationId: loc._id });
        const nam = await LockerV2.countDocuments({ locationId: loc._id, zone:"NAM" });
        const nu = await LockerV2.countDocuments({ locationId: loc._id, zone:"NU" });
        const occ = await LockerV2.countDocuments({ locationId: loc._id, status:"OCCUPIED" });
        const main = await LockerV2.countDocuments({ locationId: loc._id, status:"MAINTENANCE" });
        const aw = await LockerV2.countDocuments({ locationId: loc._id, status:"AWAIT_KEY_RETURN" });
        console.log(`   - ${loc.title}: ${c} (NAM:${nam} NU:${nu} | OCC:${occ} MAIN:${main} AWAIT:${aw})`);
      }
    }
     allLockers = await LockerV2.find({}).select("_id lockerNumber locationId zone status prefix");
  } else {
    console.log(`✅ Locker đã có sẵn ${lockerCount} tủ (đủ 4 trạng thái), bỏ qua`);
    allLockers = await LockerV2.find({}).select("_id lockerNumber locationId zone status prefix");
  }

  // ---- Lịch sử điểm danh hội viên (per CLB) và chấm công nhân viên ----
  // FIX: Bổ sung thời gian tập, gói tập, và thông tin hội viên đầy đủ cho chi tiết
  console.log("📌 Đang tạo lịch sử điểm danh & chấm công per CLB (bản đầy đủ chi tiết)...");
  if (CLEAN_ARG) {
    await CheckIn.deleteMany({});
    await StaffAttendance.deleteMany({});
    await StaffShift.deleteMany({});
  } else {
    const ciCount = await CheckIn.countDocuments();
    const saCount = await StaffAttendance.countDocuments();
    const hasCheckout = await CheckIn.countDocuments({ checkOutTime: { $ne: null } });
    const hasPkg = await CheckIn.countDocuments({ userPackageId: { $ne: null } });
    // Nếu thiếu checkout (<80%) hoặc thiếu gói tập -> tạo lại để đủ "thời gian tập" và "gói tập"
    if (ciCount > 800 && saCount > 800 && hasCheckout > ciCount*0.8 && hasPkg === ciCount) {
      console.log(`✅ Lịch sử đã có sẵn CheckIn:${ciCount} (checkout:${hasCheckout}), StaffAttendance:${saCount}, bỏ qua`);
    } else {
      if (ciCount > 0) await CheckIn.deleteMany({});
      if (saCount > 0) await StaffAttendance.deleteMany({});
      await StaffShift.deleteMany({});
      if (ciCount > 0) console.log(`⚠️ Lịch sử điểm danh thiếu chi tiết (checkout ${hasCheckout}/${ciCount}, pkg ${hasPkg}) -> xóa và tạo lại đầy đủ...`);
    }
  }
  // Tạo CheckIn per CLB: ĐẢM BẢO đủ thời gian tập, gói tập, locker, method để FE hiển thị
  if ((await CheckIn.countDocuments()) === 0) {
    const checkins = [];
    const year = new Date().getFullYear();
    const monthsDemo = [3,4,5,6,7,8];
    // Lấy gói tập thực tế per customer để chi tiết "Gói tập của hội viên" không trống
    const userPackages = await UserPackage.find({}).populate("package_id", "name features ptSessionsPerMonth isFullMonth unitPrice").lean();
    const pkgMap = new Map(); // customerId -> [pkgId, pkgId...]
    for (const up of userPackages) {
      const cid = String(up.customer_id);
      if (!pkgMap.has(cid)) pkgMap.set(cid, []);
      pkgMap.get(cid).push(up._id);
    }
    for (const cust of customers) {
      const custPkgs = pkgMap.get(String(cust._id)) || [];
      // Mỗi hội viên đã có 2-4 gói từ seed-demo.js, đảm bảo luôn có pkgId hợp lệ
      for (const m of monthsDemo) {
        const daysInMonth = new Date(year, m+1,0).getDate();
        for (let d=1; d<=daysInMonth; d++) {
          const date = new Date(year, m, d);
          if (date > new Date()) continue;
          if (Math.random() < 0.55) continue; // ~45% ngày có tập
          if (date.getDay()===0 && Math.random()<0.3) continue;
          date.setHours(rand(6,19), rand(0,59), rand(0,59), 0);
          // Thời gian tập 45-150 phút -> đủ cột "Thời gian tập" (trước thiếu vì checkOut null)
          const durationMin = rand(45, 150);
          const out = new Date(date.getTime()+ durationMin*60000);
          let lockerId=null, lockerNumber="";
          if (Math.random()<0.45 && allLockers.length) {
            const pool=allLockers.filter(l=> String(l.locationId)===String(cust.locationId));
            if(pool.length){ const lk=pick(pool); lockerId=lk._id; lockerNumber=lk.lockerNumber; }
          }
          const pkgId = custPkgs.length ? pick(custPkgs) : new mongoose.Types.ObjectId();
          checkins.push({
            customerId: cust._id,
            userPackageId: pkgId,
            locationId: cust.locationId,
            checkInTime: date,
            checkOutTime: out, // LUÔN có checkout để tính thời gian tập (95% có)
            status: "checked-out",
            method: pick(["QR_CODE","FACE_ID","QR_CODE","FACE_ID","QR_CODE"]),
            lockerId, lockerNumber,
            createdAt: date,
          });
          // 8% thêm lượt 2 trong ngày (tập 2 ca)
          if (Math.random() < 0.08) {
            const date2 = new Date(date); date2.setHours(rand(17,20), rand(0,59), 0, 0);
            if (date2 > date) {
              const out2 = new Date(date2.getTime()+ rand(40,100)*60000);
              let lk2=null, ln2="";
              if (Math.random()<0.3 && allLockers.length) {
                const pool=allLockers.filter(l=> String(l.locationId)===String(cust.locationId));
                if(pool.length){ const lk=pick(pool); lk2=lk._id; ln2=lk.lockerNumber; }
              }
              checkins.push({
                customerId: cust._id, userPackageId: pkgId, locationId: cust.locationId,
                checkInTime: date2, checkOutTime: out2, status:"checked-out",
                method: pick(["QR_CODE","FACE_ID"]), lockerId: lk2, lockerNumber: ln2, createdAt: date2,
              });
            }
          }
        }
      }
      // Các tháng khác thưa hơn nhưng vẫn đủ để demo
      for (let m=0; m<12; m++) if (!monthsDemo.includes(m)) {
        for (let d=1; d<= new Date(year,m+1,0).getDate(); d++) {
          if (Math.random()<0.82) continue;
          const date=new Date(year,m,d); date.setHours(rand(6,19),rand(0,59),0,0);
          if(date>new Date()) continue;
          let lockerId=null, lockerNumber="";
          if(Math.random()<0.3 && allLockers.length){
            const pool=allLockers.filter(l=> String(l.locationId)===String(cust.locationId));
            if(pool.length){ const lk=pick(pool); lockerId=lk._id; lockerNumber=lk.lockerNumber; }
          }
          const pkgId = custPkgs.length ? pick(custPkgs) : new mongoose.Types.ObjectId();
          checkins.push({
            customerId: cust._id, userPackageId: pkgId, locationId: cust.locationId,
            checkInTime: date, checkOutTime: new Date(date.getTime()+ rand(45,120)*60000),
            status:"checked-out", method:"QR_CODE", lockerId, lockerNumber, createdAt: date,
          });
        }
      }
    }
    // hôm nay 60 lượt để hôm nay luôn có data
    const todayOnly=new Date(); todayOnly.setHours(0,0,0,0);
    for(let i=0;i<60;i++){
      const cust=pick(customers);
      const custPkgs = pkgMap.get(String(cust._id)) || [];
      const pkgId = custPkgs.length ? pick(custPkgs) : new mongoose.Types.ObjectId();
      const checkIn=new Date(todayOnly); checkIn.setHours(rand(6,20),rand(0,59),rand(0,59),0);
      if (checkIn > new Date()) continue;
      const out = new Date(checkIn.getTime()+ rand(60,150)*60000);
      let lockerId=null, lockerNumber="";
      if(Math.random()<0.5 && allLockers.length){
        const pool=allLockers.filter(l=> String(l.locationId)===String(cust.locationId));
        if(pool.length){ const lk=pick(pool); lockerId=lk._id; lockerNumber=lk.lockerNumber; }
      }
      checkins.push({
        customerId: cust._id, userPackageId: pkgId, locationId: cust.locationId,
        checkInTime: checkIn, checkOutTime: Math.random() < 0.1 ? null : out, // 90% đã checkout -> có thời gian tập
        status: Math.random()<0.1 && !out ? "success" : "checked-out",
        method: pick(["QR_CODE","FACE_ID"]), lockerId, lockerNumber, createdAt: checkIn,
      });
    }
    if (checkins.length) {
      await CheckIn.insertMany(checkins, { ordered:false });
      console.log(`✅ CheckIn: ${checkins.length} lượt (per CLB, 95% có checkOut -> đủ Thời gian tập, 100% có userPackageId -> đủ Gói tập)`);
    }
  }
  // Tạo StaffShift & StaffAttendance per CLB - ĐẢM BẢO đủ ca, giờ vào/ra, tăng ca, đi muộn, về sớm, vắng, đang làm
  // Ca sáng: 06:00-13:30 | Ca chiều: 13:30-21:00 (khớp SHIFT_TIMES ở staffAttendanceController.js)
  // FE StaffAttendanceHistory cần: shiftId link, checkIn/out, totalMinutes, minutesLate, overtime, absent (shift không attendance)
  if ((await StaffAttendance.countDocuments()) === 0) {
    const shifts=[]; const atts=[];
    const year=new Date().getFullYear();
    const monthsDemo=[3,4,5,6,7,8];
    const SHIFT_START = { "morning-noon": 6*60, "afternoon-evening": 13*60+30 };
    const SHIFT_END = { "morning-noon": 13*60+30, "afternoon-evening": 21*60 };
    const today = new Date(); today.setHours(0,0,0,0);
    // Tạo shift trước để attendance có shiftId liên kết (trước thiếu -> FE không hiện ca)
    for(const s of staffList){
      for(const m of monthsDemo){
        const daysInMonth=new Date(year,m+1,0).getDate();
        for(let d=1; d<=daysInMonth; d++){
          const date=new Date(year,m,d); date.setHours(0,0,0,0);
          if(date>new Date()) continue;
          if(Math.random()<0.10) continue; // 90% có phân ca
          if(date.getDay()===0 && Math.random()<0.25) continue;
          const shiftsForDay = [];
          if (Math.random() < 0.55) { shiftsForDay.push("morning-noon"); }
          if (Math.random() < 0.55) { shiftsForDay.push("afternoon-evening"); }
          if (shiftsForDay.length===0) shiftsForDay.push(pick(["morning-noon","afternoon-evening"]));
          for (const sh of shiftsForDay) {
            shifts.push({ staffId: s._id, date, shift: sh, locationId: s.locationId, notes: Math.random()<0.15 ? pick(["Ca bù","Trực lễ","Hỗ trợ CLB khác","Tăng cường cuối tuần","Trực sự kiện"]) : "" });
          }
        }
      }
      for(let m=0;m<12;m++) if(!monthsDemo.includes(m)){
        for(let d=1; d<= new Date(year,m+1,0).getDate(); d++){
          if(Math.random()<0.70) continue;
          const date=new Date(year,m,d); date.setHours(0,0,0,0);
          if(date>new Date()) continue;
          shifts.push({ staffId: s._id, date, shift: pick(["morning-noon","afternoon-evening"]), locationId: s.locationId, notes: "" });
        }
      }
      // ĐẢM BẢO 14 ngày gần nhất (kể cả hôm nay) luôn có phân ca dày để demo lịch sử + cảnh báo vắng
      for (let back = 13; back >= 0; back--) {
        const date = new Date(today); date.setDate(date.getDate() - back);
        if (date > new Date()) continue;
        if (date.getDay() === 0 && Math.random() < 0.3) continue; // CN nghỉ 30%
        if (Math.random() < 0.08) continue; // 8% cố ý không phân ca
        const shiftsForDay = [];
        const r = Math.random();
        if (r < 0.35) shiftsForDay.push("morning-noon", "afternoon-evening"); // 35% cả ngày
        else shiftsForDay.push(pick(["morning-noon", "afternoon-evening"]));
        for (const sh of shiftsForDay) {
          shifts.push({ staffId: s._id, date: new Date(date), shift: sh, locationId: s.locationId, notes: back === 0 && Math.random() < 0.2 ? "Ca hôm nay" : "" });
        }
      }
    }
    // dedup shifts
    const uniq=new Map();
    for(const sh of shifts){
      const key=`${sh.staffId}-${sh.date.toISOString().slice(0,10)}-${sh.shift}`;
      if(!uniq.has(key)) uniq.set(key, sh);
    }
    const shiftDocs = uniq.size ? await StaffShift.insertMany([...uniq.values()], {ordered:false}) : [];
    console.log(`✅ StaffShift: ${shiftDocs.length} ca (per CLB, đủ để chấm công liên kết shiftId)`);
    // Map shift để attendance liên kết shiftId
    const shiftMap = new Map(); // staffId-date -> shiftDoc
    for (const sd of shiftDocs) {
      const k = `${sd.staffId}-${sd.date.toISOString().slice(0,10)}-${sd.shift}`;
      shiftMap.set(k, sd);
      const k2 = `${sd.staffId}-${sd.date.toISOString().slice(0,10)}`;
      if (!shiftMap.has(k2)) shiftMap.set(k2, sd);
    }
    // Helper sinh 1 lượt chấm công với đủ case: đúng giờ / đi muộn / về sớm / tăng ca / đang làm
    const buildAttendance = (s, date, linkedShift, forceToday = false) => {
      const shiftType = linkedShift?.shift || pick(["morning-noon", "afternoon-evening"]);
      const shiftStart = SHIFT_START[shiftType];
      const shiftEnd = SHIFT_END[shiftType];
      const roll = Math.random();
      let offsetMin, overtimeMin = 0, earlyMin = 0, hasCheckout = true;
      if (roll < 0.50) offsetMin = rand(-10, 12);            // 50% đúng giờ (trong grace 15p)
      else if (roll < 0.75) offsetMin = rand(16, 60);        // 25% đi muộn 5-60p (sau grace)
      else if (roll < 0.85) offsetMin = rand(-5, 10);        // 10% đúng giờ nhưng về sớm
      else offsetMin = rand(-10, 20);                       // còn lại random
      // 20% tăng ca 30-120p sau giờ kết thúc ca | 10% về sớm 15-60p
      if (Math.random() < 0.20) overtimeMin = rand(30, 120);
      else if (Math.random() < 0.10) earlyMin = rand(15, 60);
      // Hôm nay: 15% đang làm chưa checkout ; ngày cũ: 5% quên checkout
      if (forceToday ? Math.random() < 0.15 : Math.random() < 0.05) hasCheckout = false;
      const checkIn = new Date(date);
      checkIn.setHours(Math.floor((shiftStart + offsetMin) / 60), (shiftStart + offsetMin) % 60, rand(0, 59), 0);
      if (checkIn > new Date()) return null; // ca chiều hôm nay chưa tới giờ thì bỏ qua
      let checkOut = null;
      if (hasCheckout) {
        const outMin = shiftEnd + overtimeMin - earlyMin + rand(-5, 5);
        checkOut = new Date(date);
        checkOut.setHours(Math.floor(outMin / 60), outMin % 60, rand(0, 59), 0);
        if (checkOut <= checkIn) checkOut = new Date(checkIn.getTime() + rand(6, 8) * 3600000);
        if (checkOut > new Date()) checkOut = new Date(); // không checkout tương lai
      }
      const minutesLate = Math.max(0, offsetMin - 15); // grace 15p (khớp controller)
      const status = !hasCheckout ? "checked-in" : (minutesLate > 0 ? "late" : "checked-out");
      let note = "";
      if (minutesLate > 30) note = pick(["Kẹt xe", "Họp trễ", "Lý do cá nhân", "Xe hỏng dọc đường"]);
      else if (minutesLate > 0) note = pick(["", "", "Kẹt xe nhẹ", "Đến trễ ít phút"]);
      if (overtimeMin > 0 && Math.random() < 0.4) note = (note ? note + "; " : "") + "Ở lại tăng ca";
      return {
        staffId: s._id, shiftId: linkedShift?._id || null, date: new Date(date),
        checkInTime: checkIn, checkOutTime: checkOut,
        locationId: s.locationId, status, minutesLate, note,
      };
    };
    // Tạo attendance linked shiftId (giữ 10% shift không chấm công để demo cảnh báo vắng mặt)
    for(const s of staffList){
      for(const m of monthsDemo){
        const daysInMonth=new Date(year,m+1,0).getDate();
        for(let d=1; d<=daysInMonth; d++){
          const date=new Date(year,m,d); date.setHours(0,0,0,0);
          if(date>new Date()) continue;
          // Bỏ qua 14 ngày gần nhất ở đây để xử lý riêng bên dưới (tránh trùng unique staffId+date)
          if ((today - date) / 86400000 <= 13) continue;
          if(Math.random()<0.13) continue; // 87% có chấm công (13% vắng để demo absent)
          if(date.getDay()===0 && Math.random()<0.3) continue;
          const shiftKey = `${s._id}-${date.toISOString().slice(0,10)}`;
          const linkedShift = shiftMap.get(shiftKey) || null;
          const rec = buildAttendance(s, date, linkedShift, false);
          if (rec) atts.push(rec);
        }
      }
      for(let m=0;m<12;m++) if(!monthsDemo.includes(m)){
        for(let d=1; d<= new Date(year,m+1,0).getDate(); d++){
          if(Math.random()<0.78) continue;
          const date=new Date(year,m,d); date.setHours(0,0,0,0);
          if(date>new Date()) continue;
          if ((today - date) / 86400000 <= 13) continue;
          const shiftKey = `${s._id}-${date.toISOString().slice(0,10)}`;
          const linkedShift = shiftMap.get(shiftKey) || null;
          const rec = buildAttendance(s, date, linkedShift, false);
          if (rec) atts.push(rec);
        }
      }
      // 14 ngày gần nhất: chấm công dày 90% để demo hôm nay / thống kê tuần-tháng luôn có số liệu
      for (let back = 13; back >= 0; back--) {
        const date = new Date(today); date.setDate(date.getDate() - back);
        if (date > new Date()) continue;
        if (date.getDay() === 0 && Math.random() < 0.3) continue;
        const shiftKey = `${s._id}-${date.toISOString().slice(0,10)}`;
        const linkedShift = shiftMap.get(shiftKey) || null;
        if (!linkedShift && Math.random() < 0.5) continue; // không có phân ca thì 50% nghỉ
        if (linkedShift && Math.random() < 0.10) continue; // 10% cố ý vắng dù có phân ca -> demo cảnh báo vắng
        if (Math.random() < 0.08) continue;
        const rec = buildAttendance(s, date, linkedShift, back === 0);
        if (rec) atts.push(rec);
      }
    }
    if(atts.length) {
      const attMap=new Map();
      for(const a of atts){
        const k=`${a.staffId}-${a.date.toISOString().slice(0,10)}`;
        if(!attMap.has(k)) attMap.set(k,a);
      }
      await StaffAttendance.insertMany([...attMap.values()], {ordered:false});
      const vals = [...attMap.values()];
      const late = vals.filter(a => a.minutesLate > 0).length;
      const working = vals.filter(a => !a.checkOutTime).length;
      console.log(`✅ StaffAttendance: ${attMap.size} lượt (đúng giờ ~50%, đi muộn:${late}, đang làm chưa checkout:${working}, 20% tăng ca, 10% về sớm, 10% vắng để demo absent)`);
      for (const loc of locs) {
        const sh = await StaffShift.countDocuments({ locationId: loc._id });
        const at = await StaffAttendance.countDocuments({ locationId: loc._id });
        const la = await StaffAttendance.countDocuments({ locationId: loc._id, minutesLate: { $gt: 0 } });
        const wo = await StaffAttendance.countDocuments({ locationId: loc._id, checkOutTime: null });
        console.log(`   - ${loc.title}: Shift:${sh} Attendance:${at} (muộn:${la} đang làm:${wo})`);
      }
    } else {
      console.log(`✅ StaffShift: ${uniq.size}, StaffAttendance: 0`);
    }
  }

  // ---- Dịch vụ hội viên: đóng băng / kích hoạt / chuyển nhượng / thuê tủ đồ (ĐẦY ĐỦ CHI TIẾT) ----
  console.log("📌 Đang tạo yêu cầu dịch vụ hội viên (freeze/activate/transfer/locker/cancel-refund/complaint/support/contract)...");
  if (CLEAN_ARG) await ServiceRequest.deleteMany({});
  let srCount = await ServiceRequest.countDocuments();
  const hasFreeze = await ServiceRequest.countDocuments({ service_type: "freeze" });
  const hasTransfer = await ServiceRequest.countDocuments({ service_type: "transfer" });
  const hasLocker = await ServiceRequest.countDocuments({ service_type: "locker" });
  const hasDataDetail = await ServiceRequest.countDocuments({ "data.packageId": { $exists: true } });
  if (srCount > 60 && hasFreeze > 5 && hasTransfer > 5 && hasLocker > 5 && hasDataDetail > 20) {
    console.log(`✅ ServiceRequest đã có sẵn ${srCount} yêu cầu (freeze:${hasFreeze} transfer:${hasTransfer} locker:${hasLocker} chi tiết:${hasDataDetail}), bỏ qua`);
  } else {
    if (srCount > 0) {
      await ServiceRequest.deleteMany({});
      console.log(`⚠️ ServiceRequest thiếu chi tiết (tổng ${srCount}, freeze ${hasFreeze}, transfer ${hasTransfer}, locker ${hasLocker}, data.packageId ${hasDataDetail}) -> xóa và tạo lại đầy đủ...`);
    }
    const allUserPackages = await UserPackage.find({}).populate("package_id", "name unitPrice").lean();
    const pkgByCustomer = new Map();
    for (const up of allUserPackages) {
      const cid = String(up.customer_id);
      if (!pkgByCustomer.has(cid)) pkgByCustomer.set(cid, []);
      pkgByCustomer.get(cid).push(up);
    }
    const activePkgs = allUserPackages.filter(p => (p.status === "đang hoạt động" || p.status === "còn 10 ngày") && p.payment_status === "đã thanh toán");
    const frozenPkgs = allUserPackages.filter(p => p.status === "đang tạm ngưng");
    // Nếu chưa có gói đóng băng nào (do seed-demo chưa tạo), tạm tạo 8 gói đóng băng để demo activate
    if (frozenPkgs.length < 8 && activePkgs.length > 8) {
      for (let i = 0; i < 8; i++) {
        const up = activePkgs[i];
        const frozenAt = new Date(Date.now() - rand(3, 20)*24*3600*1000);
        const frozenUntil = new Date(frozenAt); frozenUntil.setMonth(frozenUntil.getMonth() + rand(1,2));
        await UserPackage.findByIdAndUpdate(up._id, { status: "đang tạm ngưng", frozenAt, frozenUntil });
        up.status = "đang tạm ngưng"; up.frozenAt = frozenAt; up.frozenUntil = frozenUntil;
        frozenPkgs.push(up);
      }
      console.log(`📌 Đã tạo thêm ${frozenPkgs.length} gói "đang tạm ngưng" để demo dịch vụ kích hoạt`);
    }
    const availableLockers = allLockers.filter(l => l.status === "AVAILABLE");
    // fallback nếu locker demo chưa có AVAILABLE (do lọc), lấy từ DB
    let lockerPool = availableLockers;
    if (lockerPool.length < 10) {
      const dbAv = await LockerV2.find({ status: "AVAILABLE" }).select("_id lockerNumber locationId").lean();
      lockerPool = dbAv.length ? dbAv : allLockers;
    }
    const reqs = [];
    const now = new Date();
    const staffByLoc = new Map();
    for (const st of staffList) {
      const lid = String(st.locationId);
      if (!staffByLoc.has(lid)) staffByLoc.set(lid, []);
      staffByLoc.get(lid).push(st);
    }
    const getStaffForLoc = (locId) => {
      const arr = staffByLoc.get(String(locId)) || staffList;
      return pick(arr);
    };
    // Helper tạo payment cho dịch vụ có phí
    const buildPayment = (fee, createdAt) => {
      if (fee <= 0) return { amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "" };
      const isPaid = Math.random() < 0.55;
      const status = isPaid ? "paid" : pick(["unpaid","unpaid","unpaid"]); // 55% đã thanh toán
      const method = isPaid ? pick(["vnpay","wallet","momo","bank-transfer","qr-code"]) : "";
      const paidAt = isPaid ? new Date(createdAt.getTime() + rand(5, 120)*60000) : null;
      const txnRef = method === "vnpay" && isPaid ? `SVCPAY${Date.now().toString().slice(-6)}${rand(1000,9999)}` : (method === "vnpay" ? `SVCPAY${Date.now().toString().slice(-6)}${rand(1000,9999)}` : "");
      return {
        amount: fee, payment_status: status, payment_method: method, paid_at: paidAt,
        vnpay_txn_ref: txnRef, vnpay_transaction_no: (method==="vnpay"&&isPaid)?`${rand(10000000,99999999)}`:"",
        vnpay_bank_code: (method==="vnpay"?pick(["NCB","VISA","MB","BIDV","VIETCOM"]):"")
      };
    };
    // 1) TẠM NGƯNG GÓI TẬP (freeze) - 22 yêu cầu
    for (let i = 0; i < 22; i++) {
      const cust = pick(customers.filter(c => pkgByCustomer.has(String(c._id))));
      if (!cust) continue;
      const cPkgs = pkgByCustomer.get(String(cust._id)).filter(p => (p.status==="đang hoạt động"||p.status==="còn 10 ngày") && p.payment_status==="đã thanh toán");
      const up = cPkgs.length ? pick(cPkgs) : pick(pkgByCustomer.get(String(cust._id)));
      if (!up) continue;
      const pkgName = up.package_id?.name || "Gói tập";
      const duration = pick(["1","2","3"]);
      const reason = pick(["Đi công tác dài ngày","Về quê chăm người thân","Chấn thương cần nghỉ ngơi","Bận thi cử","Du lịch nước ngoài"]);
      const createdAt = new Date(Date.now() - rand(0, 25)*24*3600*1000 - rand(0,12)*3600*1000);
      const fee = pick([50000, 80000, 100000]); // phí tạm ngưng
      const pay = buildPayment(fee, createdAt);
      const status = pay.payment_status === "paid" ? pick(["pending","accepted","rejected","pending"]) : "awaiting_payment";
      const isDone = status === "accepted" || status === "rejected";
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "freeze",
        description: `Tạm ngưng gói "${pkgName}" trong ${duration} tháng. Lý do: ${reason}`,
        data: { packageId: up._id, packageName: pkgName, duration, reason, durationDays: Number(duration)*30, previousStatus: up.status, totalPrice: up.total_price, startDate: up.start_date, endDate: up.end_date },
        location_id: cust.locationId, status, ...pay, createdAt,
        admin_note: isDone ? (status==="accepted" ? pick(["Đã duyệt tạm ngưng","Đồng ý, đã đóng băng gói"]) : pick(["Không đủ điều kiện tạm ngưng","Gói sắp hết hạn, từ chối"])) : "",
        processed_by: isDone ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: isDone ? new Date(createdAt.getTime()+ rand(1,48)*3600*1000) : null,
      });
    }
    // 2) KÍCH HOẠT LẠI (activate) - 12 yêu cầu
    for (let i = 0; i < 12; i++) {
      const cust = pick(customers.filter(c => pkgByCustomer.get(String(c._id))?.some(p=>p.status==="đang tạm ngưng")));
      const cPkgs = pkgByCustomer.get(String(cust._id)) || [];
      const up = cPkgs.find(p=>p.status==="đang tạm ngưng") || pick(frozenPkgs) || pick(cPkgs);
      if (!up) continue;
      const pkgName = up.package_id?.name || "Gói tập";
      const reason = pick(["Đã trở lại tập luyện","Kết thúc công tác","Hồi phục chấn thương","Hoàn thành kỳ thi"]);
      const createdAt = new Date(Date.now() - rand(0, 20)*24*3600*1000);
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "activate",
        description: `Kích hoạt lại gói "${pkgName}" (đang tạm ngưng) . Lý do: ${reason}`,
        data: { packageId: up._id, packageName: pkgName, reason, frozenAt: up.frozenAt || new Date(Date.now()-7*86400000), frozenUntil: up.frozenUntil || new Date(Date.now()+7*86400000), previousStatus: "đang tạm ngưng" },
        location_id: cust.locationId, status: pick(["pending","accepted","accepted","rejected"]), amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "", createdAt,
        admin_note: Math.random()<0.6? pick(["Đã kích hoạt lại, cộng thêm ngày tạm ngưng","Duyệt kích hoạt"]): "",
        processed_by: Math.random()<0.7 ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: Math.random()<0.7 ? new Date(createdAt.getTime()+ rand(2,24)*3600*1000) : null,
      });
    }
    // 3) CHUYỂN NHƯỢNG (transfer) - 16 yêu cầu
    for (let i = 0; i < 16; i++) {
      const sender = pick(customers.filter(c => pkgByCustomer.has(String(c._id))));
      const sPkgs = pkgByCustomer.get(String(sender._id)).filter(p=> (p.status==="đang hoạt động"||p.status==="còn 10 ngày") && p.payment_status==="đã thanh toán");
      if (!sPkgs.length) continue;
      const up = pick(sPkgs);
      const pkgName = up.package_id?.name || "Gói tập";
      const sameLocRecipients = customers.filter(c=> String(c.locationId)===String(sender.locationId) && String(c._id)!==String(sender._id));
      if (!sameLocRecipients.length) continue;
      const recipient = pick(sameLocRecipients);
      const reason = pick(["Chuyển cho người thân","Không còn nhu cầu tập","Chuyển cho bạn bè","Đổi cơ sở, chuyển cho đồng nghiệp"]);
      const createdAt = new Date(Date.now() - rand(0, 22)*24*3600*1000);
      const fee = pick([100000, 150000, 200000]);
      const pay = buildPayment(fee, createdAt);
      const status = pay.payment_status==="paid" ? pick(["pending","accepted","rejected"]) : "awaiting_payment";
      const isDone = status==="accepted"||status==="rejected";
      const recipientInfo = { _id: recipient._id, fullName: recipient.fullName, phone: recipient.phone, account: recipient.account, avatar: recipient.avatar || "" };
      reqs.push({
        customer_id: sender._id, customer_name: sender.fullName, customer_phone: sender.phone,
        service_type: "transfer",
        description: `Chuyển nhượng gói "${pkgName}" cho ${recipient.fullName} (${recipient.phone}). Lý do: ${reason}`,
        data: { packageId: up._id, packageName: pkgName, recipientId: recipient._id, recipient: recipient.phone, recipientName: recipient.fullName, recipientInfo, reason, senderLocation: String(sender.locationId), recipientLocation: String(recipient.locationId), totalPrice: up.total_price, endDate: up.end_date },
        location_id: sender.locationId, status, ...pay, createdAt,
        admin_note: isDone ? (status==="accepted" ? "Đã chuyển nhượng thành công, đổi chủ gói" : pick(["Sai thông tin người nhận","Người nhận không cùng CLB","Gói không đủ điều kiện chuyển"])) : "",
        processed_by: isDone ? getStaffForLoc(sender.locationId)._id : null,
        processed_at: isDone ? new Date(createdAt.getTime()+ rand(3,72)*3600*1000) : null,
      });
    }
    // 4) THUÊ TỦ ĐỒ (locker) - 18 yêu cầu (đủ để demo hết 4 trạng thái thanh toán + duyệt)
    for (let i = 0; i < 18; i++) {
      const cust = pick(customers);
      const locker = pick(lockerPool);
      const durationDays = pick([7, 14, 15, 30]);
      const feePerDay = 15000; const fee = feePerDay * durationDays;
      const createdAt = new Date(Date.now() - rand(0, 18)*24*3600*1000);
      const pay = buildPayment(fee, createdAt);
      const status = pay.payment_status==="paid" ? pick(["pending","accepted","rejected","pending"]) : "awaiting_payment";
      const isDone = status==="accepted"||status==="rejected";
      const note = pick(["Gần khu vực Cardio","Tủ lớn","Gần phòng thay đồ","Tầng 2"]);
      // Khi accepted và tủ AVAILABLE -> sẽ được gán (applyServiceEffect), nếu tủ bận -> waiting
      const lockerNumber = locker.lockerNumber || `${locker.prefix||"LK"}-${String(rand(1,32)).padStart(3,"0")}`;
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "locker",
        description: `Thuê tủ ${lockerNumber} trong ${durationDays} ngày. Ghi chú: ${note}`,
        data: { lockerId: locker._id, lockerNumber, durationDays, note, feePerDay, totalFee: fee, lockerPrefix: locker.prefix, lockerZone: locker.zone, locationId: String(cust.locationId) },
        location_id: cust.locationId, status, ...pay, createdAt,
        admin_note: isDone ? (status==="accepted" ? `Đã gán tủ ${lockerNumber}` : "Tủ đang bận / yêu cầu không hợp lệ") : "",
        processed_by: isDone ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: isDone ? new Date(createdAt.getTime()+ rand(2,36)*3600*1000) : null,
        refund_amount: (status==="rejected" && pay.payment_status==="paid") ? fee : 0,
        refunded_at: (status==="rejected" && pay.payment_status==="paid") ? new Date() : null,
      });
    }
    // 5) HỦY GÓI / HOÀN PHÍ (cancel-refund) - 10 yêu cầu
    for (let i = 0; i < 10; i++) {
      const cust = pick(customers.filter(c=> pkgByCustomer.has(String(c._id))));
      const up = pick(pkgByCustomer.get(String(cust._id)) || []);
      if (!up) continue;
      const pkgName = up.package_id?.name || "Gói tập";
      const reason = pick(["Chuyển nhà xa phòng tập","Không sắp xếp được thời gian","Vấn đề sức khỏe","Dịch vụ không như kỳ vọng"]);
      const bankName = pick(["Vietcombank","MB Bank","BIDV","Techcombank","VPBank"]);
      const accNo = `9${rand(1000000000,9999999999)}`;
      const accName = cust.fullName.toUpperCase();
      const createdAt = new Date(Date.now() - rand(0, 30)*24*3600*1000);
      const refundExpect = Math.floor((up.total_price||500000)*0.7);
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "cancel-refund",
        description: `Hủy gói "${pkgName}" - Hoàn phí. Lý do: ${reason} | Hoàn về ${bankName} • ${accNo}`,
        data: { packageId: up._id, packageName: pkgName, reason, bankName, accountNumber: accNo, accountName: accName, refundExpect, totalPrice: up.total_price, noRefund: false },
        location_id: cust.locationId, status: pick(["pending","accepted","rejected","pending"]), amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "", createdAt,
        admin_note: Math.random()<0.5 ? pick(["Đã hoàn phí","Từ chối hoàn do quá hạn","Duyệt hoàn 70%"]): "",
        processed_by: Math.random()<0.6 ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: Math.random()<0.6 ? new Date(createdAt.getTime()+ rand(5,72)*3600*1000) : null,
        refund_amount: Math.random()<0.3 ? refundExpect : 0,
        refunded_at: Math.random()<0.3 ? new Date() : null,
      });
    }
    // 6) KHIẾU NẠI / GÓP Ý (complaint) - 8 yêu cầu
    for (let i = 0; i < 8; i++) {
      const cust = pick(customers);
      const subject = pick(["Khiếu nại","Góp ý","Khen ngợi"]);
      const content = pick(["Máy chạy bộ khu A kêu to","Điều hòa phòng Yoga chưa mát","HLV rất nhiệt tình, cảm ơn","Đề xuất thêm lớp Zumba buổi tối","Nhà vệ sinh cần vệ sinh thường xuyên hơn"]);
      const createdAt = new Date(Date.now() - rand(0, 15)*24*3600*1000);
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "complaint",
        description: `[${subject}] ${content}`,
        data: { subject, content, category: pick(["facility","service","staff","other"]), priority: pick(["low","medium","high"]) },
        location_id: cust.locationId, status: pick(["pending","accepted","rejected"]), amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "", createdAt,
        admin_note: Math.random()<0.5 ? pick(["Đã tiếp nhận","Cảm ơn góp ý, sẽ cải thiện","Đã xử lý"]): "",
        processed_by: Math.random()<0.5 ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: Math.random()<0.5 ? new Date(createdAt.getTime()+ rand(4,48)*3600*1000) : null,
      });
    }
    // 7) HỖ TRỢ (support) - 6 yêu cầu
    for (let i = 0; i < 6; i++) {
      const cust = pick(customers);
      const content = pick(["Cần hỗ trợ đổi lịch tập","Hỏi về chính sách gia hạn","Cần tư vấn dinh dưỡng","Quên mật khẩu, cần hỗ trợ"]);
      const createdAt = new Date(Date.now() - rand(0, 10)*24*3600*1000);
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "support",
        description: content,
        data: { content, channel: pick(["app","phone","counter"]) },
        location_id: cust.locationId, status: pick(["pending","accepted","rejected"]), amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "", createdAt,
        admin_note: Math.random()<0.4 ? "Đã hỗ trợ": "",
        processed_by: Math.random()<0.4 ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: Math.random()<0.4 ? new Date(createdAt.getTime()+ rand(2,24)*3600*1000) : null,
      });
    }
    // 8) HỢP ĐỒNG (contract) - 5 yêu cầu xem/chính sách
    for (let i = 0; i < 5; i++) {
      const cust = pick(customers.filter(c=> pkgByCustomer.has(String(c._id))));
      const up = pick(pkgByCustomer.get(String(cust._id)) || []);
      if (!up) continue;
      const pkgName = up.package_id?.name || "Gói tập";
      const createdAt = new Date(Date.now() - rand(0, 8)*24*3600*1000);
      reqs.push({
        customer_id: cust._id, customer_name: cust.fullName, customer_phone: cust.phone,
        service_type: "contract",
        description: `Yêu cầu xem hợp đồng gói "${pkgName}"`,
        data: { packageId: up._id, packageName: pkgName, contractRequested: true },
        location_id: cust.locationId, status: pick(["pending","accepted"]), amount: 0, payment_status: "unpaid", payment_method: "", paid_at: null, vnpay_txn_ref: "", vnpay_transaction_no: "", vnpay_bank_code: "", createdAt,
        admin_note: Math.random()<0.5 ? "Đã gửi hợp đồng": "",
        processed_by: Math.random()<0.5 ? getStaffForLoc(cust.locationId)._id : null,
        processed_at: Math.random()<0.5 ? new Date(createdAt.getTime()+ rand(1,12)*3600*1000) : null,
      });
    }
    // Gán createdAt thực để sort đúng, shuffle nhẹ
    for (const r of reqs) if (!r.createdAt) r.createdAt = new Date(Date.now() - rand(0,20)*86400000);
    // Thêm refund cho rejected đã thanh toán
    for (const r of reqs) {
      if (r.status==="rejected" && r.payment_status==="paid" && r.amount>0 && !r.refund_amount) {
        r.refund_amount = r.amount; r.refunded_at = new Date(); r.payment_status = "refunded";
      }
    }
    const docs = await ServiceRequest.insertMany(reqs, { ordered: false });
    console.log(`✅ ServiceRequest: ${docs.length} yêu cầu (freeze:22 activate:12 transfer:16 locker:18 cancel-refund:10 complaint:8 support:6 contract:5) - ĐẦY ĐỦ data chi tiết cho FE`);
    // Thống kê per CLB
    for (const loc of locs) {
      const c = await ServiceRequest.countDocuments({ location_id: loc._id });
      const fr = await ServiceRequest.countDocuments({ location_id: loc._id, service_type: "freeze" });
      const tr = await ServiceRequest.countDocuments({ location_id: loc._id, service_type: "transfer" });
      const lk = await ServiceRequest.countDocuments({ location_id: loc._id, service_type: "locker" });
      console.log(`   - ${loc.title}: ${c} (freeze:${fr} transfer:${tr} locker:${lk})`);
    }
  }

  await mongoose.disconnect();
  console.log("🎉 Xong! Chạy lại trên máy khác chỉ cần: node seed-demo2.js");
}

seedEquipment().catch(e=>{console.error(e); process.exit(1);});
