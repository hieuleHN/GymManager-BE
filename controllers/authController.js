import { findCustomerByAccount } from '../models/customerModel.js';
import { findStaffByAccount } from '../models/staffModel.js';
import { getPermissionsByJob } from '../models/permissionModel.js';
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

    if (customer) {
      if (customer.status === 'locked') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa!' });
      }
      return bcrypt.compare(password, customer.password, (err, isMatch) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!isMatch) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });

        const token = jwt.sign(
          { id: customer._id, role: 'member', username: customer.account, isStaff: false },
          JWT_SECRET,
          { expiresIn: '3d' }
        );
        return res.json({
          message: 'Đăng nhập thành công!',
          token,
          user: {
            id: customer._id,
            username: customer.account,
            fullName: customer.fullName || customer.account,
            role: 'member',
            isStaff: false,
            status: customer.status,
            balance: customer.balance || 0
          }
        });
      });
    }

    findStaffByAccount(account, (err, staff) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!staff) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });

      bcrypt.compare(password, staff.password, (err, isMatch) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!isMatch) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });

        const jobId = staff.job?._id;
        const isAdmin = staff.job?.isAdmin === true;
        const jobPermissions = staff.job?.permissions || [];

        getPermissionsByJob(jobId, (err, permission) => {
          let permissions = [];
          if (permission && permission.permissions) {
            permissions = permission.permissions
              .filter(p => p.actions && p.actions.length > 0)
              .map(p => p.feature);
          }

          const token = jwt.sign(
            { id: staff._id, role: staff.job?.name || 'staff', username: staff.account, fullName: staff.fullName, isStaff: true, jobId, isAdmin },
            JWT_SECRET,
            { expiresIn: '3d' }
          );
          return res.json({
            message: 'Đăng nhập thành công!',
            token,
            user: {
              id: staff._id,
              username: staff.account,
              fullName: staff.fullName,
              role: staff.job?.name || 'staff',
              jobId,
              isStaff: true,
              isAdmin,
              locationId: staff.locationId || null,
              permissions,
              jobPermissions
            }
          });
        });
      });
    });
  });
};
