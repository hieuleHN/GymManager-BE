import {
  createRegistration, getUserPackages, getRegistrationById, cancelRegistrationById,
  updateRegistrationById
} from '../models/userPackageModel.js';
import Package from '../models/schemas/packageSchema.js';
import UserPackage from '../models/schemas/userPackageSchema.js';
import Customer from '../models/schemas/customerSchema.js';
import * as PolicyModel from '../models/policyModel.js';
import { generateContractPDF } from '../services/pdfService.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

export const registerPackage = (req, res) => {
  const customer_id = req.user.id;
  const { package_id, locationId, duration_months, total_price, signature, policies: policyIds } = req.body;

  if (!package_id || !locationId || !duration_months || !total_price) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin đăng ký!' });
  }

  if (!signature || !signature.trim()) {
    return res.status(400).json({ error: 'Vui lòng ký tên (chữ ký điện tử) để hoàn tất đăng ký!' });
  }

  Package.findById(package_id).exec()
    .then(pkg => {
      if (!pkg) return res.status(404).json({ error: 'Gói tập không tồn tại!' });
      if (!pkg.is_active) return res.status(400).json({ error: 'Gói tập hiện không khả dụng!' });

      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);
      const payment_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h to pay

      const registrationData = {
        customer_id, package_id, locationId,
        duration_months, total_price, signature,
        start_date, end_date,
        payment_status: 'pending',
        payment_expires_at,
        status: 'chờ xác nhận'
      };

      createRegistration(registrationData, async (err, result) => {
        if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký gói tập: ' + err.message });

        try {
          const customer = await Customer.findById(customer_id);
          let policies = [];
          if (policyIds && policyIds.length > 0) {
            policies = await PolicyModel.getByIds(policyIds);
          } else {
            policies = await PolicyModel.getAllSimple();
          }

          const pdfFileName = await generateContractPDF({
            registration: result,
            pkg,
            customer,
            policies: Array.isArray(policies) ? policies : (policies?.data || [])
          });

          result.contract_pdf = pdfFileName;
          await result.save();

          res.status(201).json({
            message: 'Đăng ký gói tập thành công! Vui lòng thanh toán trong vòng 24h.',
            registration: {
              id: result._id,
              package_id: result.package_id,
              start_date: result.start_date,
              end_date: result.end_date,
              status: result.status,
              payment_status: result.payment_status,
              payment_expires_at: result.payment_expires_at,
              contract_pdf: pdfFileName
            }
          });
        } catch (pdfErr) {
          console.error('PDF generation error:', pdfErr);
          res.status(201).json({
            message: 'Đăng ký gói tập thành công!',
            registration: {
              id: result._id,
              package_id: result.package_id,
              start_date: result.start_date,
              end_date: result.end_date,
              status: result.status,
              payment_status: 'pending',
              payment_expires_at: result.payment_expires_at
            }
          });
        }
      });
    })
    .catch(err => res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message }));
};

export const listMyPackages = (req, res) => {
  const customer_id = req.user.id;

  getUserPackages(customer_id, (err, registrations) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách gói tập: ' + err.message });
    res.status(200).json(registrations);
  });
};

export const getRegistrationDetail = (req, res) => {
  const { id } = req.params;

  getRegistrationById(id, (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    res.status(200).json(reg);
  });
};

export const adminRegisterPackage = (req, res) => {
  const { customerId, package_id, locationId, duration_months, total_price, signature } = req.body;

  if (!customerId || !package_id || !locationId || !duration_months || !total_price) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin đăng ký!' });
  }

  Package.findById(package_id).exec()
    .then(pkg => {
      if (!pkg) return res.status(404).json({ error: 'Gói tập không tồn tại!' });
      if (!pkg.is_active) return res.status(400).json({ error: 'Gói tập hiện không khả dụng!' });

      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);

      const registrationData = {
        customer_id: customerId,
        package_id, locationId,
        duration_months, total_price,
        signature: signature || '',
        start_date, end_date,
        payment_status: 'paid',
        payment_expires_at: null,
        status: 'chờ xác nhận'
      };

      createRegistration(registrationData, async (err, result) => {
        if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký gói tập: ' + err.message });

        try {
          const customer = await Customer.findById(customerId);
          const pdfFileName = await generateContractPDF({
            registration: result,
            pkg,
            customer,
            policies: []
          });

          result.contract_pdf = pdfFileName;
          await result.save();

          res.status(201).json({
            message: 'Đăng ký gói tập cho hội viên thành công!',
            registration: {
              id: result._id,
              contract_pdf: pdfFileName
            }
          });
        } catch (pdfErr) {
          console.error('PDF generation error:', pdfErr);
          res.status(201).json({
            message: 'Đăng ký gói tập cho hội viên thành công!'
          });
        }
      });
    })
    .catch(err => res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message }));
};

export const cancelRegistration = (req, res) => {
  const { id } = req.params;

  getRegistrationById(id, async (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });

    // Delete PDF file if exists
    if (reg.contract_pdf) {
      const pdfPath = path.resolve('uploads/contracts', reg.contract_pdf);
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      } catch (e) {
        console.error('Error deleting PDF:', e);
      }
    }

    cancelRegistrationById(id, (err2, result) => {
      if (err2) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err2.message });
      res.status(200).json({ message: 'Đã hủy đăng ký gói tập!', registration: result });
    });
  });
};

export const confirmPayment = (req, res) => {
  const { id } = req.params;

  getRegistrationById(id, (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    if (reg.payment_status === 'paid') return res.status(400).json({ error: 'Đơn hàng đã được thanh toán!' });
    if (reg.payment_status === 'cancelled') return res.status(400).json({ error: 'Đơn hàng đã bị hủy!' });

    updateRegistrationById(id, { payment_status: 'paid', payment_expires_at: null }, (err2, result) => {
      if (err2) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err2.message });
      res.status(200).json({
        message: 'Thanh toán thành công!',
        registration: {
          id: result._id,
          payment_status: result.payment_status,
          contract_pdf: result.contract_pdf
        }
      });
    });
  });
};

export const getContractPDF = (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  // Support token in query param for opening in new tab
  let authUser = req.user;
  if (token && !authUser) {
    try {
      authUser = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token không hợp lệ!' });
    }
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Chưa xác thực!' });
  }

  getRegistrationById(id, (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    if (!reg.contract_pdf) return res.status(404).json({ error: 'Không tìm thấy hợp đồng PDF!' });

    const isAdmin = authUser.isStaff || authUser.role === 'admin' || authUser.isAdmin;
    const isOwner = reg.customer_id?._id?.toString() === authUser.id || reg.customer_id?.toString() === authUser.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền xem hợp đồng này!' });
    }

    if (!isAdmin && isOwner) {
      if (reg.payment_status !== 'paid') {
        return res.status(403).json({ error: 'Hợp đồng chỉ khả dụng sau khi thanh toán!' });
      }
    }

    const pdfPath = path.resolve('uploads/contracts', reg.contract_pdf);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'File hợp đồng không tồn tại!' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${reg.contract_pdf}"`);
    fs.createReadStream(pdfPath).pipe(res);
  });
};

export const adminListRegistrations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      UserPackage.find()
        .populate('customer_id', 'fullName email phone account')
        .populate('package_id', 'name unitPrice')
        .populate('locationId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserPackage.countDocuments()
    ]);
    res.status(200).json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
  }
};

export const adminApproveRegistration = (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  getRegistrationById(id, (err, reg) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    if (reg.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Hội viên chưa thanh toán, không thể xác nhận!' });
    }

    if (action === 'approve') {
      updateRegistrationById(id, { status: 'đang hoạt động' }, (err2, result) => {
        if (err2) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err2.message });
        const customerId = reg.customer_id?._id || reg.customer_id;
        res.status(200).json({
          message: 'Đã xác nhận đăng ký gói tập!',
          registration: result,
          customerId: customerId?.toString()
        });
      });
    } else if (action === 'reject') {
      // Delete PDF
      if (reg.contract_pdf) {
        const pdfPath = path.resolve('uploads/contracts', reg.contract_pdf);
        try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) {}
      }
      updateRegistrationById(id, { status: 'đã hủy', contract_pdf: '' }, (err2, result) => {
        if (err2) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err2.message });
        res.status(200).json({ message: 'Đã từ chối đăng ký gói tập!', registration: result });
      });
    } else {
      res.status(400).json({ error: 'Hành động không hợp lệ!' });
    }
  });
};
