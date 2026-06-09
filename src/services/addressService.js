import axios from 'axios';

const addressApi = axios.create({
  baseURL: 'https://production.cas.so/address-kit'
});

export const getProvinces = async (
  effectiveDate = 'latest'
) => {
  const { data } = await addressApi.get(
    `/${effectiveDate}/provinces`
  );

  return data;
};

export const getCommunesByProvince = async (
  provinceCode,
  effectiveDate = 'latest'
) => {
  const { data } = await addressApi.get(
    `/${effectiveDate}/provinces/${provinceCode}/communes`
  );
  
  return data;
};