const {
    PackageV2,
    PackageSaleV2,
    PACKAGE_STATUS,
    PACKAGE_TYPE,
    PACKAGE_TYPE_LABELS,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABELS,
    SALE_STATUS,
    SALE_STATUS_LABELS
} = require('../models/packageModel');
const {
    getEffectivePrice,
    getDurationLabel,
    filterPackageByType,
    searchMatch,
    summarizePackages,
    summarizeSales,
    buildSaleCode
} = require('../services/packageService');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const getPackageList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, type, status } = req.query;

        const allPackages = await PackageV2.find().sort({ createdAt: -1 });
        const total = allPackages.length;

        const filtered = allPackages.filter(pkg => {
            const matchesSearch = searchMatch(pkg, search);
            const matchesType = filterPackageByType(pkg, type);
            const matchesStatus = !status || status === 'ALL' || pkg.status === status;
            return matchesSearch && matchesType && matchesStatus;
        });

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách gói tập V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách gói tập V2',
            error: error.message
        });
    }
};

const getPackageSummary = async (req, res) => {
    try {
        const summary = await summarizePackages();
        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan gói tập V2 thành công',
            data: summary
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan gói tập V2',
            error: error.message
        });
    }
};

const getPackageTypes = async (req, res) => {
    try {
        const types = Object.values(PACKAGE_TYPE).map(key => ({
            key,
            label: PACKAGE_TYPE_LABELS[key]
        }));
        const paymentMethods = Object.values(PAYMENT_METHOD).map(key => ({
            key,
            label: PAYMENT_METHOD_LABELS[key]
        }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách loại gói V2 thành công',
            data: {
                types,
                paymentMethods,
                saleStatuses: Object.values(SALE_STATUS).map(key => ({
                    key,
                    label: SALE_STATUS_LABELS[key]
                }))
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách loại gói V2',
            error: error.message
        });
    }
};

const getPackageById = async (req, res) => {
    try {
        const pkg = await PackageV2.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin gói tập V2 thành công',
            data: pkg
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin gói tập V2',
            error: error.message
        });
    }
};

const getRelatedPackages = async (req, res) => {
    try {
        const currentId = req.params.id;
        const limit = parseInt(req.query.limit) || 4;

        const current = await PackageV2.findById(currentId);
        if (!current) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }

        const filter = {
            _id: { $ne: currentId },
            status: PACKAGE_STATUS.ACTIVE
        };
        if (current.type) filter.type = current.type;

        const related = await PackageV2.find(filter).limit(limit).sort({ sold: -1 });
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách gói liên quan V2 thành công',
            data: related
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy gói liên quan V2',
            error: error.message
        });
    }
};

const createPackage = async (req, res) => {
    try {
        const {
            name,
            type,
            price,
            originalPrice,
            discountPercent,
            durationMonths,
            durationDays,
            ptSessionsPerMonth,
            isFullMonth,
            features,
            description,
            image
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập tên gói tập!'
            });
        }
        if (price === undefined || Number(price) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Giá gói tập không hợp lệ!'
            });
        }
        if (discountPercent !== undefined && (Number(discountPercent) < 0 || Number(discountPercent) > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Phần trăm khuyến mãi phải nằm trong khoảng 0 - 100!'
            });
        }

        const featureList = Array.isArray(features)
            ? features.map(item => String(item).trim()).filter(item => item)
            : String(features || '').split(',').map(item => item.trim()).filter(item => item);

        const pkg = await PackageV2.create({
            name: name.trim(),
            type: Object.values(PACKAGE_TYPE).includes(type) ? type : PACKAGE_TYPE.STANDARD,
            price: Number(price),
            originalPrice: Number(originalPrice) || 0,
            discountPercent: Number(discountPercent) || 0,
            durationMonths: Number(durationMonths) || 0,
            durationDays: Number(durationDays) || 0,
            ptSessionsPerMonth: Number(ptSessionsPerMonth) || 0,
            isFullMonth: !!isFullMonth,
            features: featureList,
            description: description || '',
            image: image || '',
            status: PACKAGE_STATUS.ACTIVE
        });

        return res.status(201).json({
            success: true,
            message: 'Thêm gói tập V2 thành công',
            data: pkg
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thêm gói tập V2',
            error: error.message
        });
    }
};

const updatePackage = async (req, res) => {
    try {
        const pkg = await PackageV2.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }

        const {
            name,
            type,
            price,
            originalPrice,
            discountPercent,
            durationMonths,
            durationDays,
            ptSessionsPerMonth,
            isFullMonth,
            features,
            description,
            image,
            status
        } = req.body;

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tên gói tập không được để trống!'
                });
            }
            pkg.name = name.trim();
        }
        if (price !== undefined && Number(price) >= 0) pkg.price = Number(price);
        if (originalPrice !== undefined) pkg.originalPrice = Number(originalPrice);
        if (discountPercent !== undefined) {
            if (Number(discountPercent) < 0 || Number(discountPercent) > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Phần trăm khuyến mãi phải nằm trong khoảng 0 - 100!'
                });
            }
            pkg.discountPercent = Number(discountPercent);
        }
        if (durationMonths !== undefined) pkg.durationMonths = Number(durationMonths);
        if (durationDays !== undefined) pkg.durationDays = Number(durationDays);
        if (ptSessionsPerMonth !== undefined) pkg.ptSessionsPerMonth = Number(ptSessionsPerMonth);
        if (isFullMonth !== undefined) pkg.isFullMonth = !!isFullMonth;
        if (features !== undefined) {
            pkg.features = Array.isArray(features)
                ? features.map(item => String(item).trim()).filter(item => item)
                : String(features).split(',').map(item => item.trim()).filter(item => item);
        }
        if (description !== undefined) pkg.description = description;
        if (image !== undefined) pkg.image = image;
        if (type !== undefined && Object.values(PACKAGE_TYPE).includes(type)) pkg.type = type;
        if (status !== undefined && Object.values(PACKAGE_STATUS).includes(status)) pkg.status = status;

        const saved = await pkg.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật gói tập V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật gói tập V2',
            error: error.message
        });
    }
};

const togglePackageStatus = async (req, res) => {
    try {
        const pkg = await PackageV2.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }

        const nextStatus = pkg.status === PACKAGE_STATUS.ACTIVE ? PACKAGE_STATUS.INACTIVE : PACKAGE_STATUS.ACTIVE;
        pkg.status = nextStatus;
        const saved = await pkg.save();

        return res.status(200).json({
            success: true,
            message: nextStatus === PACKAGE_STATUS.ACTIVE ? 'Kích hoạt gói tập V2 thành công' : 'Tạm dừng gói tập V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thay đổi trạng thái gói tập V2',
            error: error.message
        });
    }
};

const deletePackage = async (req, res) => {
    try {
        const pkg = await PackageV2.findByIdAndDelete(req.params.id);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }
        await PackageSaleV2.updateMany(
            { packageId: req.params.id },
            { $set: { packageId: null } }
        );
        return res.status(200).json({
            success: true,
            message: 'Xóa gói tập V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa gói tập V2',
            error: error.message
        });
    }
};

const registerCheckout = async (req, res) => {
    try {
        const pkg = await PackageV2.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gói tập V2!'
            });
        }
        if (pkg.status !== PACKAGE_STATUS.ACTIVE) {
            return res.status(400).json({
                success: false,
                message: 'Gói tập đang tạm dừng, không thể đăng ký!'
            });
        }

        const { customerName, customerPhone, customerEmail, quantity, paymentMethod, note } = req.body;

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập tên khách hàng!'
            });
        }
        if (!customerPhone || !customerPhone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập số điện thoại khách hàng!'
            });
        }

        const qty = parseInt(quantity) || 1;
        if (qty < 1) {
            return res.status(400).json({
                success: false,
                message: 'Số lượng phải lớn hơn 0!'
            });
        }

        const unitPrice = getEffectivePrice(pkg);
        const totalPrice = unitPrice * qty;

        const sale = await PackageSaleV2.create({
            packageId: pkg._id,
            packageName: pkg.name,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail || '',
            quantity: qty,
            unitPrice,
            discountPercent: pkg.discountPercent || 0,
            totalPrice,
            paymentMethod: Object.values(PAYMENT_METHOD).includes(paymentMethod) ? paymentMethod : PAYMENT_METHOD.CASH,
            status: SALE_STATUS.COMPLETED,
            note: note || ''
        });

        await PackageV2.findByIdAndUpdate(
            pkg._id,
            {
                $inc: { sold: qty, totalRevenue: totalPrice }
            },
            { new: true }
        );

        const saleCode = buildSaleCode(sale);

        return res.status(201).json({
            success: true,
            message: `Đăng ký gói tập "${pkg.name}" thành công. Mã giao dịch: ${saleCode}`,
            data: sale
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi đăng ký gói tập V2',
            error: error.message
        });
    }
};

const getSaleList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, status } = req.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (status && status !== 'ALL') filter.status = status;
        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { packageName: regex },
                { customerName: regex },
                { customerPhone: regex }
            ];
        }

        const [data, total] = await Promise.all([
            PackageSaleV2.find(filter)
                .populate('packageId', 'name type')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            PackageSaleV2.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách giao dịch gói tập V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách giao dịch gói tập V2',
            error: error.message
        });
    }
};

const getSaleSummary = async (req, res) => {
    try {
        const summary = await summarizeSales();
        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan giao dịch gói tập V2 thành công',
            data: summary
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan giao dịch gói tập V2',
            error: error.message
        });
    }
};

const updateSaleStatus = async (req, res) => {
    try {
        const sale = await PackageSaleV2.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch V2!'
            });
        }

        const { status } = req.body;
        if (!status || !Object.values(SALE_STATUS).includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái giao dịch không hợp lệ!'
            });
        }

        const wasCompleted = sale.status === SALE_STATUS.COMPLETED;
        const nowCompleted = status === SALE_STATUS.COMPLETED;

        if (!wasCompleted && nowCompleted && sale.packageId) {
            await PackageV2.findByIdAndUpdate(
                sale.packageId,
                { $inc: { sold: sale.quantity, totalRevenue: sale.totalPrice } },
                { new: true }
            );
        }
        if (wasCompleted && !nowCompleted && sale.packageId) {
            await PackageV2.findByIdAndUpdate(
                sale.packageId,
                { $inc: { sold: -sale.quantity, totalRevenue: -sale.totalPrice } },
                { new: true }
            );
        }

        sale.status = status;
        const saved = await sale.save();

        return res.status(200).json({
            success: true,
            message: 'Cập nhật trạng thái giao dịch V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật trạng thái giao dịch V2',
            error: error.message
        });
    }
};

const deleteSale = async (req, res) => {
    try {
        const sale = await PackageSaleV2.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch V2!'
            });
        }

        if (sale.status === SALE_STATUS.COMPLETED && sale.packageId) {
            await PackageV2.findByIdAndUpdate(
                sale.packageId,
                { $inc: { sold: -sale.quantity, totalRevenue: -sale.totalPrice } },
                { new: true }
            );
        }

        await PackageSaleV2.findByIdAndDelete(req.params.id);
        return res.status(200).json({
            success: true,
            message: 'Xóa giao dịch gói tập V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa giao dịch gói tập V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getEffectivePrice,
    getDurationLabel,
    getPackageList,
    getPackageSummary,
    getPackageTypes,
    getPackageById,
    getRelatedPackages,
    createPackage,
    updatePackage,
    togglePackageStatus,
    deletePackage,
    registerCheckout,
    getSaleList,
    getSaleSummary,
    updateSaleStatus,
    deleteSale
};
