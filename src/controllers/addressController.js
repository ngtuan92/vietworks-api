import * as addressService from '../services/addressService.js';

export const getProvinces = async (req, res) => {
  const data = await addressService.getProvinces();
  res.json(data);
};

export const getCommunes = async (req, res) => {
  const data = await addressService.getCommunesByProvince(
    req.params.provinceCode
  );

  res.json(data);
};