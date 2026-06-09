import express from 'express';
import {
  getProvinces,
  getCommunes
} from '../controllers/addressController.js';

const router = express.Router();

router.get('/provinces', getProvinces);
router.get(
  '/provinces/:provinceCode/communes',
  getCommunes
);

export default router;