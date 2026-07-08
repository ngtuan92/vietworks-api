import * as addressService from '../services/addressService.js';

// 1. Hàm lấy Tỉnh (Bóc tách .provinces)
export const getProvinces = async (req, res) => {
  try {
    const responseData = await addressService.getProvinces();
    // Bóc tách chuẩn mảng tỉnh của CAS Kit
    const result = responseData?.provinces || responseData?.data?.provinces || [];
    res.json(result);
  } catch (error) {
    console.error("Lỗi lấy Tỉnh:", error.message);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách Tỉnh/Thành phố' });
  }
};

// 2. Hàm lấy Phường/Xã theo mã Tỉnh
export const getCommunes = async (req, res) => {
  try {
    let { provinceCode } = req.params; 
    
    if (!provinceCode) {
      return res.status(400).json({ message: 'Thiếu mã Tỉnh/Thành phố' });
    }

    provinceCode = String(provinceCode).trim();

    // 1. Gọi API lấy communes thay vì districts
    let responseData = await addressService.getCommunesByProvince(provinceCode);
    let communesArray = responseData?.communes || responseData?.data?.communes || [];

    // 2. CÓ CHÚT TỰ ĐỘNG KHẮC PHỤC (MẸO): Nếu lần 1 trả về mảng rỗng [], thử chuyển đổi mã tỉnh
    if (!Array.isArray(communesArray) || communesArray.length === 0) {
      let alternativeCode = provinceCode;
      if (provinceCode.startsWith('0') && provinceCode.length > 1) {
        alternativeCode = provinceCode.substring(1); // "01" -> "1"
      } else if (provinceCode.length === 1) {
        alternativeCode = '0' + provinceCode; // "1" -> "01"
      }

      console.log(`[CAS Kit] Mã ${provinceCode} trả về mảng rỗng. Đang thử lại với mã thay thế: ${alternativeCode}`);
      
      responseData = await addressService.getCommunesByProvince(alternativeCode);
      communesArray = responseData?.communes || responseData?.data?.communes || [];
    }

    const finalResult = Array.isArray(communesArray) ? communesArray : [];
    
    console.log(`=> Gửi về Frontend ${finalResult.length} Phường/Xã.`);
    return res.json(finalResult);

  } catch (error) {
    console.error("Lỗi xử lý tại addressController:", error.message);
    res.status(500).json({ message: 'Lỗi server khi tải dữ liệu địa lý' });
  }
};