import db from '../config/db.js';

export const getAll = (callback) => {
  db.query('SELECT * FROM location', callback);
};

export const getById = (id, callback) => {
  db.query('SELECT * FROM location WHERE id = ?', [id], callback);
};

export const create = (data, callback) => {
  const { address, phone } = data;
  db.query('INSERT INTO location (address, phone) VALUES (?, ?)', [address, phone], callback);
};

export const update = (id, data, callback) => {
  const { address, phone } = data;
  db.query('UPDATE location SET address = ?, phone = ? WHERE id = ?', [address, phone, id], callback);
};

export const remove = (id, callback) => {
  db.query('DELETE FROM location WHERE id = ?', [id], callback);
};