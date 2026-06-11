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

// 2. Hàm lấy Huyện theo mã Tỉnh (Bóc tách chuẩn .districts)
export const getCommunes = async (req, res) => {
  try {
    let { provinceCode } = req.params; 
    
    if (!provinceCode) {
      return res.status(400).json({ message: 'Thiếu mã Tỉnh/Thành phố' });
    }

    // Làm sạch chuỗi mã tỉnh đầu vào
    provinceCode = String(provinceCode).trim();

    // 1. GỌI LẦN 1: Thử gọi với mã hiện tại (ví dụ: "01" hoặc "1")
    let responseData = await addressService.getDistrictsByProvince(provinceCode);
    let districtsArray = responseData?.districts || responseData?.data?.districts || responseData?.data || [];

    // 2. CƠ CHẾ TỰ ĐỘNG KHẮC PHỤC (MẸO): Nếu lần 1 trả về mảng rỗng [], thử chuyển đổi mã tỉnh
    // Nếu mã đang có số 0 ở đầu (VD: "01"), ta bỏ số 0 đi thành "1"
    // Nếu mã đang không có số 0 (VD: "1"), ta thêm số 0 vào thành "01"
    if (!Array.isArray(districtsArray) || districtsArray.length === 0) {
      let alternativeCode = provinceCode;
      if (provinceCode.startsWith('0') && provinceCode.length > 1) {
        alternativeCode = provinceCode.substring(1); // "01" -> "1"
      } else if (provinceCode.length === 1) {
        alternativeCode = '0' + provinceCode; // "1" -> "01"
      }

      console.log(`[CAS Kit] Mã ${provinceCode} trả về mảng rỗng. Đang thử lại với mã thay thế: ${alternativeCode}`);
      
      responseData = await addressService.getDistrictsByProvince(alternativeCode);
      districtsArray = responseData?.districts || responseData?.data?.districts || responseData?.data || [];
    }

    // 3. IN KIỂM TRA RA THÔNG TIN TRÊN CMD/TERMINAL BACKEND
    console.log("=== KẾT QUẢ CUỐI CÙNG SAU KHI LỌC TỪ CAS KIT ===");
    console.log("Kiểu dữ liệu:", typeof districtsArray, "Có phải mảng không:", Array.isArray(districtsArray));
    console.log("Nội dung dữ liệu:", JSON.stringify(districtsArray).substring(0, 200) + "...");

    // Nếu sau tất cả vẫn không phải mảng, ép về mảng rỗng
    const finalResult = Array.isArray(districtsArray) ? districtsArray : [];
    
    console.log(`=> Gửi về Frontend ${finalResult.length} Quận/Huyện.`);
    return res.json(finalResult);

  } catch (error) {
    console.error("Lỗi xử lý tại addressController:", error.message);
    res.status(500).json({ message: 'Lỗi server khi tải dữ liệu địa lý' });
  }
};