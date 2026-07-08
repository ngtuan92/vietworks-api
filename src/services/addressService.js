import axios from 'axios';

const addressApi = axios.create({
  baseURL: 'https://production.cas.so/address-kit'
});

// 1. Lấy danh sách Tỉnh/Thành (Giữ nguyên)
export const getProvinces = async (effectiveDate = 'latest') => {
  const { data } = await addressApi.get(`/${effectiveDate}/provinces`);
  return data;
};

// 2. Lấy danh sách Quận/Huyện theo Mã Tỉnh (Đây sẽ là cấp 2 của bạn)
export const getDistrictsByProvince = async (provinceCode, effectiveDate = 'latest') => {
  const { data } = await addressApi.get(`/${effectiveDate}/provinces/${provinceCode}/districts`);
  return data;
};

// 3. Lấy danh sách Phường/Xã theo Mã Tỉnh
export const getCommunesByProvince = async (provinceCode, effectiveDate = 'latest') => {
  const { data } = await addressApi.get(`/${effectiveDate}/provinces/${provinceCode}/communes`);
  return data;
};