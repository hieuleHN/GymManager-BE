import db from '../config/db.js';

export const getAll = (callback) => {
  db.query('SELECT * FROM services', callback);
};

export const getById = (id, callback) => {
  db.query('SELECT * FROM services WHERE id = ?', [id], callback);
};

export const create = (data, callback) => {
  const { name, description } = data;
  db.query('INSERT INTO services (name, description) VALUES (?, ?)', [name, description], callback);
};

export const update = (id, data, callback) => {
  const { name, description } = data;
  db.query('UPDATE services SET name = ?, description = ? WHERE id = ?', [name, description, id], callback);
};

export const remove = (id, callback) => {
  db.query('DELETE FROM services WHERE id = ?', [id], callback);
};