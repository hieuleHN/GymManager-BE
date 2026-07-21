import Product from '../models/schemas/productSchema.js';

// 1. Lấy tất cả sản phẩm, hỗ trợ lọc theo locationId query param
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const { locationId } = req.query;
    const filter = locationId ? { location_id: locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit),
      Product.countDocuments(filter)
    ]);
    res.status(200).json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 2. Lấy sản phẩm THEO CƠ SỞ (Khớp chuẩn params :locationId của bạn)
// Khớp với: router.get('/location/:locationId', ProductController.getProductsByLocation);
export const getProductsByLocation = async (req, res) => {
  try {
    const { locationId } = req.params; // Lấy đúng biến locationId từ URL

    if (!locationId) {
      return res.status(400).json({ message: 'Thiếu locationId!' });
    }

    // Tìm trong DB xem sản phẩm nào có trường location_id trùng với locationId truyền vào
    const products = await Product.find({ location_id: locationId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 3. Lấy chi tiết MỘT sản phẩm theo ID của sản phẩm đó
// Khớp với: router.get('/:id', ProductController.getProductById);
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params; // Lấy biến id của sản phẩm
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm này!' });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 4. THÊM mới sản phẩm kèm FILE ẢNH THẬT tải lên từ giao diện
export const createProduct = async (req, res) => {
  try {
    // Tạo một đối tượng dữ liệu mới từ body gửi lên
    const productData = { ...req.body };
    productData.importQuantity = Number(req.body.quantity) || 0;

    // Kiểm tra xem Front-end có bấm chọn tệp và gửi file ảnh lên không
    if (req.file) {
      // Lưu đường dẫn file (ví dụ: uploads/1717923456.png) vào trường image trong database
      productData.image = req.file.path.replace(/\\/g, '/'); 
    }

    // Tiến hành lưu vào MongoDB
    const savedProduct = await Product.create(productData);
    
    res.status(201).json({ message: 'Thêm sản phẩm thành công!', data: savedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 5. CẬP NHẬT sản phẩm
// Khớp với: router.put('/:id', ProductController.updateProduct);
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productData = { ...req.body };
    if (req.file) {
      productData.image = req.file.path.replace(/\\/g, '/');
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      productData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật!' });
    }

    res.status(200).json({ message: 'Cập nhật thành công!', data: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 6. XÓA sản phẩm
// Khớp với: router.delete('/:id', ProductController.deleteProduct);
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa!' });
    }

    res.status(200).json({ message: 'Xóa sản phẩm thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 6b. GHI NHẬN BÁN HÀNG: trừ tồn kho, cộng số lượng đã bán
export const sellProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    if (qty < 1) {
      return res.status(400).json({ message: 'Số lượng bán phải lớn hơn 0!' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm!' });
    }

    if ((product.quantity || 0) < qty) {
      return res.status(400).json({ message: `Không đủ tồn kho! Hiện còn ${product.quantity}` });
    }

    const updated = await Product.findByIdAndUpdate(
      id,
      {
        $inc: { quantity: -qty, sold: qty },
        $push: {
          monthlySales: {
            $each: [{
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              quantity: qty,
              revenue: (product.price || 0) * qty
            }]
          }
        }
      },
      { new: true }
    );

    res.status(200).json({ message: `Đã ghi nhận bán ${qty} ${product.name}`, data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 7. THÊM báo cáo cho sản phẩm
export const addReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Vui lòng cung cấp lý do báo cáo!' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $push: { reports: { reason, reportedAt: new Date(), status: 'pending' } } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm!' });
    }

    res.status(200).json({ message: 'Báo cáo sản phẩm thành công!', data: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};

// 8. GIẢI QUYẾT báo cáo (đánh dấu resolved)
export const resolveReport = async (req, res) => {
  try {
    const { id, reportId } = req.params;

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, 'reports._id': reportId },
      { $set: { 'reports.$.status': 'resolved' } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm hoặc báo cáo!' });
    }

    res.status(200).json({ message: 'Đã giải quyết báo cáo!', data: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server!', error: error.message });
  }
};