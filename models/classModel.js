import db from '../config/db.js';

export const getAllClasses = (callback) => {
  db.query('SELECT * FROM classes', callback);
};
