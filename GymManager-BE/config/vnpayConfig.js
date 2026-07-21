import { VNPay, ignoreLogger } from 'vnpay';

const vnpay = new VNPay({
    tmnCode: process.env.VNP_TMN_CODE || 'KF6N73AY',
    secureSecret: process.env.VNP_HASH_SECRET || 'KTE745L87STW4RO89DJIFSKPGPZFL0TV',
    vnpayHost: 'https://sandbox.vnpayment.vn',
    testMode: true,
    hashAlgorithm: 'SHA512',
    enableLog: false,
    loggerFn: ignoreLogger,
});

export default vnpay;
