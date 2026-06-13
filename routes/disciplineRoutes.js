import express from 'express';
import * as DisciplineController from '../controllers/disciplineController.js';

const router = express.Router();

router.get('/', DisciplineController.list);
router.get('/:id', DisciplineController.detail);
router.post('/', DisciplineController.create);
router.put('/:id', DisciplineController.update);
router.delete('/:id', DisciplineController.remove);

export default router;