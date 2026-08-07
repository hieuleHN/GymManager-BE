const validatePhoneNumber = (phone) => {
    return /^0\d{9}$/.test(phone);
};

module.exports = { validatePhoneNumber };