import { findCustomerByAccount } from '../models/customerModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

export const login = (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu!' });
  }
  findCustomerByAccount(account, (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    if (customer.status === 'locked') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa!' });
    }
    bcrypt.compare(password, customer.password, (err, isMatch) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!isMatch) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });

      const token = jwt.sign(
        { id: customer._id, role: 'member', username: customer.account, isStaff: false },
        JWT_SECRET,
        { expiresIn: '3d' }
      );
      res.json({
        message: 'Đăng nhập thành công!',
        token,
        user: {
          id: customer._id,
          username: customer.account,
          fullName: customer.fullName || customer.account,
          role: 'member',
          isStaff: false,
          status: customer.status,
          avatar: customer.avatar || ''
        }
      });
    });
  });
};
