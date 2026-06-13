# 🎯 MongoDB Migration Guide

## ✅ Những công việc đã hoàn thành:

### 1. **Database Configuration**
- ✅ [config/db.js](config/db.js) - Chuyển từ MySQL sang MongoDB với Mongoose

### 2. **Mongoose Schemas** (Tạo mới)
- ✅ [models/schemas/roleSchema.js](models/schemas/roleSchema.js)
- ✅ [models/schemas/locationSchema.js](models/schemas/locationSchema.js)  
- ✅ [models/schemas/serviceSchema.js](models/schemas/serviceSchema.js)
- ✅ [models/schemas/packageSchema.js](models/schemas/packageSchema.js)
- ✅ [models/schemas/userSchema.js](models/schemas/userSchema.js)
- ✅ [models/schemas/userPackageSchema.js](models/schemas/userPackageSchema.js)

### 3. **Model Files - Chuyển sang MongoDB**
- ✅ [models/roleModel.js](models/roleModel.js) - Async/await with callbacks
- ✅ [models/locationModel.js](models/locationModel.js) - Hỗ trợ ảnh với embedded arrays
- ✅ [models/serviceModel.js](models/serviceModel.js) - Cascade delete
- ✅ [models/packageModel.js](models/packageModel.js) - Populate references
- ✅ [models/userModel.js](models/userModel.js) - Complex nested locations/services
- ✅ [models/userPackageModel.js](models/userPackageModel.js) - Subscription logic

### 4. **Services**
- ✅ [services/cronService.js](services/cronService.js) - Async cron jobs với MongoDB queries

### 5. **Environment & Dependencies**
- ✅ [.env](.env) - Updated với MONGODB_URI
- ✅ [package.json](package.json) - Removed mysql2, Added mongoose ^7.0.0

---

## 🚀 Các bước tiếp theo:

### 1. **Cài đặt dependencies**
```bash
npm install
```

### 2. **Khởi động MongoDB**
- Local: `mongod` (hoặc sử dụng MongoDB Compass)
- Atlas: Cập nhật `MONGODB_URI` trong .env với connection string từ MongoDB Atlas

### 3. **Khởi động Server**
```bash
npm run dev
```

### 4. **Kiểm tra kết nối**
- Server sẽ in ra: `🎯 MongoDB được kết nối thành công!`

---

## 📝 Thay đổi chính từ MySQL sang MongoDB:

| Khía cạnh | MySQL | MongoDB |
|-----------|-------|---------|
| **Kết nối** | `mysql.createConnection()` | `mongoose.connect()` |
| **Query** | SQL strings | Mongoose methods |
| **Transactions** | `db.beginTransaction()` | Async/await |
| **Foreign Keys** | Explicit joins | Populate relationships |
| **Images** | Separate table | Embedded array |
| **Callback** | `(err, results) => {}` | `(err, result) => {}` |

---

## ⚠️ Lưu ý quan trọng:

1. **Controllers** vẫn sử dụng callback pattern để tương thích. Models trả về: `callback(null, result)` hoặc `callback(err)`

2. **Embedded vs References**:
   - Ảnh được lưu dưới dạng **embedded arrays** (tối ưu cho query)
   - User references: Location, Service, Role, Package (populate khi cần)

3. **Relationships**:
   ```
   User -> Locations[] -> Services[]
   User -> Packages[] (through UserPackage)
   Package -> Service
   Service -> Location
   ```

4. **Date Handling**: 
   - MongoDB lưu Date tự động, không cần DATE_FORMAT
   - Sử dụng `new Date()` để tạo dates

5. **Cron Job**: 
   - Sử dụng `Date` objects để so sánh
   - Populate relationships để lấy email/tên người dùng

---

## 🔧 Troubleshooting:

### "MongooseError: Cannot read property '_id' of null"
- Kiểm tra ID có tồn tại trong database

### "Cast to ObjectId failed"  
- Đảm bảo ID là valid MongoDB ObjectId format

### "Schema hasn't been registered"
- Import schema đúng trong model file

---

## 📚 Tham khảo thêm:
- Mongoose Docs: https://mongoosejs.com
- MongoDB Docs: https://docs.mongodb.com
- Node-Cron: https://www.npmjs.com/package/node-cron

**Migration complete! Happy coding! 🚀**
