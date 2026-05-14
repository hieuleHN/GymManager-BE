import db from '../config/db.js';

export const getAllTrainers = (callback) => {
  db.query('SELECT * FROM trainers', callback);
};
