import db from '../config/db.js';

// Kiểm tra xem email hoặc số điện thoại đã tồn tại trong hệ thống chưa
export const checkExistingUser = (email, phone, callback) => {
  const sql = 'SELECT * FROM Users WHERE email = ? OR phone = ?';
  db.query(sql, [email, phone], callback);
};

// Tạo một người dùng mới (Mặc định khi đăng ký trên web là quyền 'Member')
export const createUser = (userData, callback) => {
  const { username, email, phone, password, role } = userData;
  const sql = 'INSERT INTO Users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [username, email, phone, password, role || 'Member'], callback);
};

// Tìm kiếm người dùng bằng email để phục vụ cho chức năng đăng nhập
export const findUserByEmail = (email, callback) => {
  const sql = 'SELECT * FROM Users WHERE email = ?';
  db.query(sql, [email], callback);
};