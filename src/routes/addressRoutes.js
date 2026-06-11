import express from 'express';
import { getProvinces, getCommunes } from '../controllers/addressController.js';

const router = express.Router();

// 1. Lấy danh sách Tỉnh/Thành
router.get('/provinces', getProvinces);

// 2. Lấy thẳng danh sách Phường/Xã dựa theo mã Tỉnh
router.get('/provinces/:provinceCode/communes', getCommunes); 

export default router;