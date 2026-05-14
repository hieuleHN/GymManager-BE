import db from '../config/db.js';

export const getAllPayments = (callback) => {
  db.query('SELECT * FROM payments', callback);
};
