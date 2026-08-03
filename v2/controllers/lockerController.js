const validateVietnamesePhone = (phone) => {
    if (!phone) return false;
    // Kiểm tra định dạng số điện thoại Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)
    return /(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone.trim());
};

const calculateMembershipStatus = (expiryDate) => {
    if (!expiryDate) return 'EXPIRED';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 7) return 'WARNING_EXPIRING_SOON';
    return 'ACTIVE';
};

const formatCustomerName = (fullName) => {
    if (!fullName) return '';
    return fullName
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

module.exports = {
    validateVietnamesePhone,
    calculateMembershipStatus,
    formatCustomerName
};