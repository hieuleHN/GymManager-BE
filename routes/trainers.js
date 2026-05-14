import express from 'express';
import { getTrainers } from '../controllers/trainerController.js';

const router = express.Router();

router.get('/', getTrainers);

export default router;
