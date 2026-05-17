import db from '../config/db.js';

export const getAll = (callback) => {
  db.query('SELECT * FROM role', callback);
};

export const getById = (id, callback) => {
  db.query('SELECT * FROM role WHERE id = ?', [id], callback);
};

export const create = (name, callback) => {
  db.query('INSERT INTO role (name) VALUES (?)', [name], callback);
};

export const update = (id, name, callback) => {
  db.query('UPDATE role SET name = ? WHERE id = ?', [name, id], callback);
};

export const remove = (id, callback) => {
  db.query('DELETE FROM role WHERE id = ?', [id], callback);
};