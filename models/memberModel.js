import db from '../config/db.js';

export const getAllMembers = (callback) => {
  db.query('SELECT * FROM members', callback);
};

export const addMember = (name, email, membershipType, callback) => {
  db.query(
    'INSERT INTO members (name, email, membershipType) VALUES (?, ?, ?)',
    [name, email, membershipType],
    callback
  );
};
