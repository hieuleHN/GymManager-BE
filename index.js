import express from 'express';
import bodyParser from 'body-parser';
import db from './config/db.js';
import dotenv from 'dotenv';
import memberRoutes from './routes/members.js';
import trainerRoutes from './routes/trainers.js';
import classRoutes from './routes/classes.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Routes
app.use('/members', memberRoutes);
app.use('/trainers', trainerRoutes);
app.use('/classes', classRoutes);
app.use('/payments', paymentRoutes);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
