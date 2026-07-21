import "dotenv/config";
import mongoose from "mongoose";

// Import Schemas
let User, Booking, CheckIn;
try {
    User = (await import("./models/schemas/userSchema.js")).default;
    Booking = (await import("./models/schemas/bookingSchema.js")).default;
    CheckIn = (await import("./models/schemas/checkInSchema.js")).default;
} catch (e) {
    User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({
        fullName: String, email: String, phone: String, role: String, currentSport: String, createdAt: Date
    }));
    Booking = mongoose.models.Booking || mongoose.model("Booking", new mongoose.Schema({
        trainerName: String, status: String, createdAt: Date
    }));
    CheckIn = mongoose.models.CheckIn || mongoose.model("CheckIn", new mongoose.Schema({
        checkInTime: Date, status: String
    }));
}

async function seedDatabase() {
    try {
        console.log("⏳ Đang thử kết nối theo cấu hình `.env` Backend...");

        // Lấy chuỗi Mongoose URI chính xác nhất từ biến môi trường
        const dbUri = process.env.MONGO_URI || process.env.DB_URI || process.env.MONGODB_URI;

        if (!dbUri) {
            console.log("⚠️ Không tìm thấy biến MONGO_URI trong .env, sử dụng kết nối localhost...");
        }

        await mongoose.connect(dbUri || "mongodb://localhost:27017/gym_management");
        console.log("🌱 KẾT NỐI DATABASE THÀNH CÔNG TẠI:", mongoose.connection.name);

        const sports = ["Gym & Fitness", "Yoga", "Boxing", "Pilates"];
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        // 1. Tạo danh sách Hội viên mẫu rải rác từ T1 đến T12
        console.log("⏳ 1/3: Đang chèn Hội viên mới cho các tháng T1 -> T12...");
        for (let i = 1; i <= 35; i++) {
            const randomMonth = months[Math.floor(Math.random() * months.length)];
            const randomSport = sports[Math.floor(Math.random() * sports.length)];
            const createdDate = new Date(2026, randomMonth - 1, Math.floor(Math.random() * 25) + 1);

            await User.create({
                fullName: `Hội viên Mẫu ${i}`,
                email: `hoivien_demo_${i}_${Date.now()}@gmail.com`,
                phone: `09876543${i < 10 ? '0' + i : i}`,
                role: "member",
                currentSport: randomSport,
                createdAt: createdDate
            }).catch(() => { });
        }

        // 2. Tạo Lượt điểm danh quét QR theo ngày trong tuần (T2 -> CN)
        console.log("⏳ 2/3: Đang chèn Lượt điểm danh tuần này...");
        const today = new Date();
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const checkInDate = new Date();
            checkInDate.setDate(today.getDate() - dayOffset);
            const count = Math.floor(Math.random() * 20) + 10;

            for (let j = 0; j < count; j++) {
                await CheckIn.create({
                    checkInTime: checkInDate,
                    status: "success"
                }).catch(() => { });
            }
        }

        // 3. Tạo Ca dạy hoàn thành của Huấn luyện viên
        console.log("⏳ 3/3: Đang chèn Lịch dạy HLV...");
        const trainers = ["HLV Nguyễn Văn A", "HLV Trần Thị B", "HLV Lê Văn C", "HLV Phạm Minh D"];

        for (let k = 0; k < 25; k++) {
            const trainer = trainers[Math.floor(Math.random() * trainers.length)];
            await Booking.create({
                trainerName: trainer,
                status: "completed",
                createdAt: new Date()
            }).catch(() => { });
        }

        console.log("--------------------------------------------------");
        console.log("🎉 TẠO DỮ LIỆU THÀNH CÔNG VÀO DATABASE:", mongoose.connection.name);
        console.log("--------------------------------------------------");
        process.exit(0);

    } catch (error) {
        console.error("❌ Lỗi kết nối hoặc chèn dữ liệu:", error);
        process.exit(1);
    }
}

seedDatabase();