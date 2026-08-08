/*
 * DỮ LIỆU VẬN HÀNH KHỞI TẠO – NHÀ XE THÀNH NHÂN
 *
 * Nguồn đối chiếu:
 * - Các tuyến xuất hiện trong dự án ASP.NET MVC cũ.
 * - Danh sách khu vực/điểm đón trả đã chốt trong dự án.
 * - Quy tắc xe 34 giường và xe 22 phòng.
 *
 * Lưu ý trung thực:
 * - ZIP MVC không chứa bản sao database cũ, nên không thể khôi phục chính xác
 *   biển số, giá vé và giờ chạy đã từng lưu trong SQL Server.
 * - Các giá trị biển số, giá và lịch bên dưới là dữ liệu khởi tạo hợp lệ để
 *   website hoạt động. Hãy sửa trực tiếp tại file này khi có số liệu thực tế.
 */

const OPERATIONAL_SCHEDULE_DAYS = 30

const locationData = [
  // Điểm tổng dùng làm đầu/cuối tuyến.
  {
    key: 'KRONG_NANG',
    name: 'Krông Năng',
    province: 'Đắk Lắk',
    address: 'Thị trấn Krông Năng, huyện Krông Năng, Đắk Lắk',
  },
  {
    key: 'BUON_MA_THUOT',
    name: 'Buôn Ma Thuột',
    province: 'Đắk Lắk',
    address: 'Thành phố Buôn Ma Thuột, Đắk Lắk',
  },
  {
    key: 'TP_HCM',
    name: 'TP.HCM',
    province: 'TP.HCM',
    address: 'Thành phố Hồ Chí Minh',
  },
  {
    key: 'BINH_DUONG',
    name: 'Bình Dương',
    province: 'Bình Dương',
    address: 'Khu vực Bình Dương',
  },

  // Đắk Lắk.
  { key: 'EA_TAN', name: 'Ea Tân', province: 'Đắk Lắk', address: 'Ea Tân, Đắk Lắk' },
  { key: 'EA_TOH', name: 'Ea Tóh', province: 'Đắk Lắk', address: 'Ea Tóh, Đắk Lắk' },
  { key: 'PHU_LOC', name: 'Phú Lộc', province: 'Đắk Lắk', address: 'Phú Lộc, Đắk Lắk' },
  { key: 'DLIE_YA', name: 'Dliê Ya', province: 'Đắk Lắk', address: 'Dliê Ya, Đắk Lắk' },
  { key: 'EA_HO', name: 'Ea Hồ', province: 'Đắk Lắk', address: 'Ea Hồ, Đắk Lắk' },
  {
    key: 'BUON_HO',
    name: 'Buôn Hồ',
    province: 'Đắk Lắk',
    address: 'Văn phòng Nhà xe Thành Nhân, Buôn Hồ, Đắk Lắk',
  },
  { key: 'KRONG_BUK', name: 'Krông Búk', province: 'Đắk Lắk', address: 'Krông Búk, Đắk Lắk' },
  { key: 'CU_MGAR', name: "Cư M'gar", province: 'Đắk Lắk', address: "Cư M'gar, Đắk Lắk" },

  // TP.HCM.
  { key: 'BINH_THANH', name: 'Bình Thạnh', province: 'TP.HCM', address: 'Quận Bình Thạnh, TP.HCM' },
  { key: 'GO_VAP', name: 'Gò Vấp', province: 'TP.HCM', address: 'Quận Gò Vấp, TP.HCM' },
  { key: 'PHU_NHUAN', name: 'Phú Nhuận', province: 'TP.HCM', address: 'Quận Phú Nhuận, TP.HCM' },
  { key: 'QUAN_1', name: 'Quận 1', province: 'TP.HCM', address: 'Quận 1, TP.HCM' },
  { key: 'QUAN_3', name: 'Quận 3', province: 'TP.HCM', address: 'Quận 3, TP.HCM' },
  { key: 'QUAN_5', name: 'Quận 5', province: 'TP.HCM', address: 'Quận 5, TP.HCM' },
  { key: 'QUAN_6', name: 'Quận 6', province: 'TP.HCM', address: 'Quận 6, TP.HCM' },
  { key: 'QUAN_10', name: 'Quận 10', province: 'TP.HCM', address: 'Quận 10, TP.HCM' },
  { key: 'QUAN_11', name: 'Quận 11', province: 'TP.HCM', address: 'Quận 11, TP.HCM' },
  { key: 'QUAN_12', name: 'Quận 12', province: 'TP.HCM', address: 'Quận 12, TP.HCM' },
  { key: 'TAN_BINH', name: 'Tân Bình', province: 'TP.HCM', address: 'Quận Tân Bình, TP.HCM' },
  { key: 'TAN_PHU', name: 'Tân Phú', province: 'TP.HCM', address: 'Quận Tân Phú, TP.HCM' },
  { key: 'THU_DUC', name: 'Thủ Đức', province: 'TP.HCM', address: 'Thành phố Thủ Đức, TP.HCM' },

  // Bình Dương – giữ đúng danh sách đã chốt trong phạm vi dự án.
  { key: 'DI_AN', name: 'Dĩ An', province: 'Bình Dương', address: 'Dĩ An, Bình Dương' },
  { key: 'PHU_GIAO', name: 'Phú Giáo', province: 'Bình Dương', address: 'Phú Giáo, Bình Dương' },
  { key: 'TAN_UYEN', name: 'Tân Uyên', province: 'Bình Dương', address: 'Tân Uyên, Bình Dương' },
  { key: 'THUAN_AN', name: 'Thuận An', province: 'Bình Dương', address: 'Thuận An, Bình Dương' },
  { key: 'CHON_THANH', name: 'Chơn Thành', province: 'Bình Dương', address: 'Chơn Thành' },
]

const routeData = [
  {
    key: 'KRONG_NANG_TP_HCM',
    departureKey: 'KRONG_NANG',
    arrivalKey: 'TP_HCM',
    distanceKm: 380,
    estimatedDurationMinutes: 480,
    defaultTicketPrice: 350000,
    defaultSingleRoomPrice: 450000,
    defaultDoubleRoomPrice: 700000,
  },
  {
    key: 'TP_HCM_KRONG_NANG',
    departureKey: 'TP_HCM',
    arrivalKey: 'KRONG_NANG',
    distanceKm: 380,
    estimatedDurationMinutes: 480,
    defaultTicketPrice: 350000,
    defaultSingleRoomPrice: 450000,
    defaultDoubleRoomPrice: 700000,
  },
  {
    key: 'BUON_MA_THUOT_TP_HCM',
    departureKey: 'BUON_MA_THUOT',
    arrivalKey: 'TP_HCM',
    distanceKm: 330,
    estimatedDurationMinutes: 420,
    defaultTicketPrice: 320000,
    defaultSingleRoomPrice: 420000,
    defaultDoubleRoomPrice: 650000,
  },
  {
    key: 'TP_HCM_BUON_MA_THUOT',
    departureKey: 'TP_HCM',
    arrivalKey: 'BUON_MA_THUOT',
    distanceKm: 330,
    estimatedDurationMinutes: 420,
    defaultTicketPrice: 320000,
    defaultSingleRoomPrice: 420000,
    defaultDoubleRoomPrice: 650000,
  },
  {
    key: 'KRONG_NANG_BINH_DUONG',
    departureKey: 'KRONG_NANG',
    arrivalKey: 'BINH_DUONG',
    distanceKm: 340,
    estimatedDurationMinutes: 450,
    defaultTicketPrice: 330000,
    defaultSingleRoomPrice: 430000,
    defaultDoubleRoomPrice: 680000,
  },
  {
    key: 'BINH_DUONG_KRONG_NANG',
    departureKey: 'BINH_DUONG',
    arrivalKey: 'KRONG_NANG',
    distanceKm: 340,
    estimatedDurationMinutes: 450,
    defaultTicketPrice: 330000,
    defaultSingleRoomPrice: 430000,
    defaultDoubleRoomPrice: 680000,
  },
]

const busData = [
  {
    key: 'TN_34_01',
    busName: 'Thành Nhân 34 giường số 01',
    licensePlate: '47B-03434',
    busType: 'SLEEPER_34',
    status: 'ACTIVE',
  },
  {
    key: 'TN_34_02',
    busName: 'Thành Nhân 34 giường số 02',
    licensePlate: '47B-03435',
    busType: 'SLEEPER_34',
    status: 'ACTIVE',
  },
  {
    key: 'TN_22_01',
    busName: 'Thành Nhân Limousine 22 phòng số 01',
    licensePlate: '47B-02222',
    busType: 'LIMOUSINE_22',
    status: 'ACTIVE',
  },
  {
    key: 'TN_22_02',
    busName: 'Thành Nhân Limousine 22 phòng số 02',
    licensePlate: '47B-02223',
    busType: 'LIMOUSINE_22',
    status: 'ACTIVE',
  },
]

/*
 * Mỗi xe chạy một chuyến/ngày, đổi chiều luân phiên để không trùng lịch.
 * Các giờ bên dưới là lịch khởi tạo, không phải dữ liệu đã khôi phục từ SQL Server.
 */
const scheduleData = [
  {
    busKey: 'TN_34_01',
    oddRouteKey: 'KRONG_NANG_TP_HCM',
    evenRouteKey: 'TP_HCM_KRONG_NANG',
    hour: 18,
    minute: 30,
  },
  {
    busKey: 'TN_34_02',
    oddRouteKey: 'TP_HCM_KRONG_NANG',
    evenRouteKey: 'KRONG_NANG_TP_HCM',
    hour: 18,
    minute: 30,
  },
  {
    busKey: 'TN_22_01',
    oddRouteKey: 'BUON_MA_THUOT_TP_HCM',
    evenRouteKey: 'TP_HCM_BUON_MA_THUOT',
    hour: 19,
    minute: 0,
  },
  {
    busKey: 'TN_22_02',
    oddRouteKey: 'KRONG_NANG_BINH_DUONG',
    evenRouteKey: 'BINH_DUONG_KRONG_NANG',
    hour: 18,
    minute: 0,
  },
]

const newsData = [
  {
    slug: 'thong-tin-lien-he-nha-xe-thanh-nhan',
    title: 'Thông tin liên hệ Nhà xe Thành Nhân',
    summary: 'Thông tin văn phòng, Hotline và Email hỗ trợ hành khách.',
    content:
      '<p><strong>Văn phòng chính:</strong> Buôn Hồ, Đắk Lắk.</p>' +
      '<p><strong>Hotline:</strong> 0979 406 406.</p>' +
      '<p><strong>Email:</strong> hotro@thanhnhanweb.vn.</p>' +
      '<p>Khi cần hỗ trợ vé, quý khách vui lòng cung cấp mã vé hoặc số điện thoại đã dùng lúc đặt vé.</p>',
  },
  {
    slug: 'huong-dan-dat-ve-truc-tuyen-thanh-nhan',
    title: 'Hướng dẫn đặt vé trực tuyến',
    summary: 'Tìm chuyến, chọn ghế, nhập thông tin và nhận vé điện tử qua Email.',
    content:
      '<p>Quý khách chọn điểm đi, điểm đến và ngày khởi hành để tìm chuyến phù hợp.</p>' +
      '<p>Sau khi chọn ghế hoặc phòng, hãy nhập đúng họ tên, số điện thoại và Email nhận vé.</p>' +
      '<p>Ghế được giữ tạm thời trong quá trình hoàn tất đặt vé.</p>',
  },
  {
    slug: 'luu-y-truoc-gio-khoi-hanh',
    title: 'Lưu ý trước giờ khởi hành',
    summary: 'Kiểm tra mã vé, điểm đón và có mặt sớm trước giờ xe chạy.',
    content:
      '<p>Quý khách vui lòng kiểm tra mã vé, ngày giờ khởi hành, ghế và điểm đón trước chuyến đi.</p>' +
      '<p>Nên có mặt trước giờ khởi hành để nhân viên hỗ trợ sắp xếp hành lý và lên xe.</p>',
  },
]

export {
  OPERATIONAL_SCHEDULE_DAYS,
  busData,
  locationData,
  newsData,
  routeData,
  scheduleData,
}
