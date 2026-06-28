import {
  createRegistration,
  getUserPackages,
  getRegistrationById,
  cancelRegistrationById,
  getAllRegistrations,
  updatePaymentStatus,
  updatePaymentMethod,
} from "../models/userPackageModel.js";
import Package from "../models/schemas/packageSchema.js";
import crypto from "crypto";

// Hàm sắp xếp tham số chuẩn VNPAY (Không dùng thư viện ngoài)
function sortObject(obj) {
  let sorted = {};
  let str = Object.keys(obj).sort();
  for (let key of str) {
    sorted[key] = obj[key];
  }
  return sorted;
}

// 1. CÁC HÀM CŨ GIỮ NGUYÊN (Không sửa đổi để tránh lỗi)
export const registerPackage = (req, res) => {
  const {
    package_id,
    locationId,
    duration_months,
    total_price,
    signature,
    payment_method,
  } = req.body;
  if (!package_id || !locationId || !duration_months || !total_price)
    return res.status(400).json({ error: "Thiếu thông tin!" });
  // if (!signature || !signature.trim())
  //   return res.status(400).json({ error: "Thiếu chữ ký!" });

  Package.findById(package_id)
    .exec()
    .then((pkg) => {
      if (!pkg) return res.status(404).json({ error: "Gói không tồn tại!" });
      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);
      createRegistration(
        {
          customer_id: req.user.id,
          package_id,
          locationId,
          duration_months,
          total_price,
          signature,
          start_date,
          end_date,
          payment_method,
          payment_status: "chờ thanh toán",
        },
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res
            .status(201)
            .json({ message: "Đăng ký thành công!", registration: result });
        },
      );
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

export const listMyPackages = (req, res) => {
  getUserPackages(req.user.id, (err, regs) => res.status(200).json(regs));
};
export const getRegistrationDetail = (req, res) => {
  getRegistrationById(req.params.id, (err, reg) => res.status(200).json(reg));
};
export const cancelRegistration = (req, res) => {
  cancelRegistrationById(req.params.id, (err, result) =>
    res.status(200).json({ message: "Đã hủy" }),
  );
};
export const listAllRegistrations = (req, res) => {
  let { page, limit, payment_status, locationId, status } = req.query;
  getAllRegistrations(
    Number(page) || 1,
    Number(limit) || 15,
    { payment_status, locationId, status },
    (err, result) => res.status(200).json(result),
  );
};
export const confirmPayment = (req, res) => {
  updatePaymentStatus(
    req.params.id,
    { payment_status: req.body.payment_status, confirmed_by: req.user.id },
    (err, result) => res.status(200).json({ message: "OK" }),
  );
};
export const setPaymentMethod = (req, res) => {
  updatePaymentMethod(
    req.params.id,
    req.user.id,
    req.body.payment_method,
    (err, result) => res.status(200).json({ message: "OK" }),
  );
};

export const createRenewOrUpgrade = (req, res) => {
  const { package_id, locationId, duration_months, total_price, action_type } =
    req.body;
  createRegistration(
    {
      customer_id: req.user.id,
      package_id,
      locationId,
      duration_months,
      total_price,
      payment_status: "chờ thanh toán",
      status: "đang hoạt động",
      start_date: new Date(),
      end_date: new Date(),
    },
    (err, result) =>
      res.status(201).json({ message: "OK", registration: result }),
  );
};

// ==========================================
// TÍNH NĂNG VNPAY MỚI (TUYỆT ĐỐI CHUẨN)
// ==========================================
export const createVnPayUrl = (req, res) => {
  const { id } = req.params;
  getRegistrationById(id, (err, reg) => {
    if (err || !reg)
      return res.status(404).json({ error: "Không tìm thấy đơn!" });

    let date = new Date();
    let tmnCode = "KF6N73AY";
    let secretKey = "KTE745L87STW4RO89DJIFSKPGPZFL0TV";
    let vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    let txnRef = date.getTime().toString();
    let amount = Math.floor(Number(reg.total_price) * 100);

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: "ThanhToanGoiTap",
      vnp_OrderType: "other",
      vnp_Amount: amount.toString(),
      vnp_ReturnUrl: "http://localhost:5173/dashboard/my-packages",
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate:
        date.getFullYear() +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        ("0" + date.getDate()).slice(-2) +
        ("0" + date.getHours()).slice(-2) +
        ("0" + date.getMinutes()).slice(-2) +
        ("0" + date.getSeconds()).slice(-2),
    };

    vnp_Params = sortObject(vnp_Params);

    // Nối chuỗi thủ công, không qua thư viện để tránh bị encode sai
    let signData = "";
    for (let key in vnp_Params) {
      signData += key + "=" + vnp_Params[key] + "&";
    }
    signData = signData.slice(0, -1); // Xóa dấu & cuối cùng

    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + new URLSearchParams(vnp_Params).toString();

    res.status(200).json({ paymentUrl: vnpUrl });
  });
};

export const vnpayReturn = (req, res) => {
  let vnp_Params = req.query;
  let secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);
  let secretKey = "KTE745L87STW4RO89DJIFSKPGPZFL0TV";
  let signData = "";
  for (let key in vnp_Params) {
    signData += key + "=" + vnp_Params[key] + "&";
  }
  signData = signData.slice(0, -1);

  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed && vnp_Params["vnp_ResponseCode"] === "00") {
    res.redirect(
      "http://localhost:5173/dashboard/my-packages?vnpay_success=true",
    );
  } else {
    res.redirect(
      "http://localhost:5173/dashboard/my-packages?vnpay_success=false",
    );
  }
};

export const createVnPayQR = (req, res) => {
  const { id } = req.params;
  getRegistrationById(id, async (err, reg) => {
    if (err || !reg)
      return res.status(404).json({ error: "Không tìm thấy đơn!" });

    let date = new Date();
    let tmnCode = "KF6N73AY";
    let secretKey = "KTE745L87STW4RO89DJIFSKPGPZFL0TV";
    let vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    let txnRef = date.getTime().toString();
    let amount = Math.floor(Number(reg.total_price) * 100);

    let createDate =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    let expireDate = new Date(date.getTime() + 15 * 60 * 1000);
    let expDateStr =
      expireDate.getFullYear() +
      ("0" + (expireDate.getMonth() + 1)).slice(-2) +
      ("0" + expireDate.getDate()).slice(-2) +
      ("0" + expireDate.getHours()).slice(-2) +
      ("0" + expireDate.getMinutes()).slice(-2) +
      ("0" + expireDate.getSeconds()).slice(-2);

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "genqr",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: "ThanhToanGoiTap",
      vnp_OrderType: "other",
      vnp_Amount: amount.toString(),
      vnp_ReturnUrl: "http://localhost:5173/dashboard/my-packages",
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expDateStr,
    };

    vnp_Params = sortObject(vnp_Params);

    let signData = "";
    for (let key in vnp_Params) {
      signData += key + "=" + vnp_Params[key] + "&";
    }
    signData = signData.slice(0, -1);

    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    vnp_Params["vnp_SecureHash"] = signed;
    let fullUrl = vnpUrl + "?" + new URLSearchParams(vnp_Params).toString();

    try {
      const response = await fetch(fullUrl);
      const data = await response.json();

      if (data.code === "00") {
        res.status(200).json({
          qrContent: data.qrcontent,
          amount: reg.total_price,
          txnRef: txnRef,
        });
      } else {
        res.status(400).json({
          error: data.message || "Lỗi tạo QR VNPay",
          code: data.code,
        });
      }
    } catch (fetchErr) {
      res
        .status(500)
        .json({ error: "Không thể kết nối VNPay: " + fetchErr.message });
    }
  });
};
