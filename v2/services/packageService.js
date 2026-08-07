const { PackageV2, PACKAGE_STATUS, PACKAGE_TYPE } = require('../models/packageModel');

const getEffectivePrice = (pkg) => {
    if (!pkg) return 0;
    const price = pkg.price || 0;
    const discount = pkg.discountPercent || 0;
    if (discount <= 0) return price;
    return Math.round(price * (1 - discount / 100));
};

const getDurationLabel = (pkg) => {
    if (!pkg) return '0 tháng';
    if ((pkg.durationMonths || 0) > 0) {
        return `${pkg.durationMonths} tháng`;
    }
    return `${pkg.durationDays || 0} ngày`;
};

const filterPackageByType = (pkg, typeFilter) => {
    if (!typeFilter || typeFilter === 'ALL') return true;
    return pkg.type === typeFilter;
};

const searchMatch = (pkg, search) => {
    if (!search) return true;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    const nameMatch = (pkg.name || '').toLowerCase().includes(keyword);
    const descriptionMatch = (pkg.description || '').toLowerCase().includes(keyword);
    const featuresMatch = (pkg.features || []).some(feature => (feature || '').toLowerCase().includes(keyword));
    return nameMatch || descriptionMatch || featuresMatch;
};

const summarizePackages = async () => {
    const packages = await PackageV2.find();
    let activeCount = 0;
    let inactiveCount = 0;
    let totalSold = 0;
    let totalRevenue = 0;
    let totalValue = 0;

    packages.forEach(pkg => {
        if (pkg.status === PACKAGE_STATUS.ACTIVE) {
            activeCount += 1;
            totalValue += getEffectivePrice(pkg);
        } else {
            inactiveCount += 1;
        }
        totalSold += pkg.sold || 0;
        totalRevenue += pkg.totalRevenue || 0;
    });

    return {
        total: packages.length,
        activeCount,
        inactiveCount,
        totalSold,
        totalRevenue,
        totalValue,
        averagePrice: packages.length ? Math.round(totalValue / packages.length) : 0
    };
};

const summarizeSales = async () => {
    const sales = await require('../models/packageModel').PackageSaleV2.find();
    let completedRevenue = 0;
    let pendingRevenue = 0;
    let cancelledCount = 0;

    sales.forEach(sale => {
        if (sale.status === 'COMPLETED') completedRevenue += sale.totalPrice || 0;
        if (sale.status === 'PENDING') pendingRevenue += sale.totalPrice || 0;
        if (sale.status === 'CANCELLED') cancelledCount += 1;
    });

    return {
        total: sales.length,
        completedRevenue,
        pendingRevenue,
        cancelledCount
    };
};

const buildSaleCode = (sale) => {
    const id = String(sale._id || '').slice(-6).toUpperCase();
    return `PKG-${id || Math.floor(Math.random() * 9000 + 1000)}`;
};

module.exports = {
    PACKAGE_STATUS,
    PACKAGE_TYPE,
    getEffectivePrice,
    getDurationLabel,
    filterPackageByType,
    searchMatch,
    summarizePackages,
    summarizeSales,
    buildSaleCode
};
