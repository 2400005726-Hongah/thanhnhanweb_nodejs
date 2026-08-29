# Checklist kiểm thử cuối - Nhà xe Thành Nhân

Chỉ thực hiện sau khi đã chép patch cuối và deploy migration. Đây là checklist một lần cho toàn hệ thống.

## 1. Chuẩn bị và kiểm tra tự động

Backend:

```powershell
cd "D:\Đồ án NODE  JS\backend"
npm run db:validate
npm run db:generate
npm run db:migrate
npm test
```

Frontend:

```powershell
cd "D:\Đồ án NODE  JS\frontend"
npm run build
npm run dev
```

Không chạy `prisma migrate reset`.

## 2. Khách hàng công khai

- Trang chủ: Header/Footer, hotline, Tin tức, Giới thiệu, Liên hệ và các liên kết chính sách hoạt động.
- Mở đủ 7 trang `/thong-tin/...` và kiểm tra không còn liên kết “Đang phát triển”.
- Tìm chuyến: chọn tỉnh đi/tỉnh đến/ngày; tick nhiều bộ lọc khu vực; mỗi chuyến phải khớp `defaultAreaId` của địa điểm cụ thể; thử giá từ/đến, giờ, loại xe, sắp xếp.
- Kiểm tra chỉ hiện chuyến mở bán, chưa khởi hành và đúng khu vực phục vụ.
- Mở chuyến 34 giường và 22 phòng; chọn ghế/phòng; với 22 phòng thử Đơn/Đôi và kiểm tra tổng tiền.
- Giữ ghế 10 phút; thử mở lại ghế từ trình duyệt khác để xác nhận chống trùng.
- Đặt Online: điểm đón/trả chính phải lấy từ điểm đi/đến cụ thể của chuyến mới; dữ liệu legacy có cấu hình cũ vẫn phải đọc được.
- PAY_AT_BUS: vé tạo thành công nhưng trạng thái thanh toán phải là Chưa thanh toán.
- Tra cứu bằng mã vé + số điện thoại; thử sai số điện thoại.
- Hủy vé trước giờ khởi hành; vé đã thanh toán phải chuyển Đã hoàn tiền và ghế mở lại.

## 3. Quản trị xe/tuyến/chuyến/địa điểm

- Đăng nhập bằng Chủ xe và Nhân viên; kiểm tra menu/quyền khác nhau.
- Xe: thêm/sửa/trạng thái; kiểm tra chuẩn hóa biển số và chống trùng; không dùng xe Bảo trì để tạo chuyến.
- Địa điểm: tỉnh/thành là dữ liệu gốc; mỗi địa điểm cụ thể phải thuộc đúng một tỉnh, một bộ lọc và một loại Điểm đón/Điểm trả/Cả hai; kiểm tra chống trùng sau chuẩn hóa.
- Tuyến xe: chỉ là trang tổng hợp đọc từ Chuyến xe, không có Thêm/Sửa/Xóa/Cấu hình điểm dừng.
- Chuyến: thêm/sửa bằng Tỉnh đi + Điểm đi cụ thể và Tỉnh đến + Điểm đến cụ thể; không chọn Tuyến xe; kiểm tra không cho hai tỉnh giống nhau và loại địa điểm phải phù hợp.
- Sau giờ khởi hành: xác nhận không sửa/hủy/ngừng bán chuyến.

## 4. Ba kênh đặt vé và ghế

- Online, Hotline, Tại quầy cùng kiểm tra ghế trống trước khi tạo vé.
- Hotline/Tại quầy: thử PAY_AT_BUS, chuyển khoản và tiền mặt phù hợp nguồn đặt.
- Kiểm tra nguồn vé hiển thị đúng Trực tuyến/Hotline/Tại quầy.
- Thử khách có tổng `Đã hủy + Không đi >= 3`: cả ba kênh phải bị chặn.

## 5. Vé và hành khách

- Danh sách Vé: lọc nguồn/trạng thái/thanh toán/ngày đặt/ngày xuất bến/từ khóa.
- Chi tiết vé, In vé và Xuất Excel.
- Sửa vé trước giờ khởi hành: chỉ các trường nghiệp vụ cho phép.
- Xóa vé chưa thanh toán trước giờ: chuyển Đã xóa, không mất lịch sử.
- Vé đã thanh toán: Xóa phải bị chặn, dùng Hủy để hoàn tiền.
- Sau giờ khởi hành: `Khách không đi`; trạng thái thanh toán phải giữ nguyên và ghế không mở lại.
- PAY_AT_BUS: `Đã thu tiền`; Chủ xe thử `Hoàn tác thu tiền` và nhập lý do.
- Danh sách hành khách: điểm đón/trả, ghế, nguồn, thanh toán, Không đi, Đã thu tiền và in danh sách.

## 6. Hoàn thành chuyến và doanh thu

- Trước giờ xuất phát không có/không dùng được Hoàn thành.
- Sau giờ xuất phát, mở preview Hoàn thành.
- Nếu còn PAY_AT_BUS chưa thu: phải cảnh báo số vé/số tiền; xác nhận thì cập nhật thanh toán rồi hoàn thành.
- Vé hợp lệ chuyển Đã hoàn thành.
- Kiểm tra Dashboard/Thống kê: chỉ Payment SUCCESS được tính doanh thu; REFUNDED không tính; PAY_AT_BUS chỉ tính sau khi thu.

## 7. Khách hàng

- Danh sách: tìm kiếm, trạng thái, phân loại, sắp xếp và thống kê.
- Kiểm tra VIP / Thường xuyên / Mới, số vi phạm, tổng chi tiêu, tuyến thường đi.
- Khóa/mở khách và kiểm tra ảnh hưởng tới đặt vé.
- Ghi chú khách hàng.
- Xuất Excel.
- Xóa khách chưa có vé; khách có vé tương lai phải bị chặn; khách có lịch sử đủ điều kiện phải chuyển Lưu trữ thay vì mất lịch sử.

## 8. Tài khoản quản trị

- Tạo STAFF; sửa tên/email/SĐT; đặt lại mật khẩu; khóa/mở; đổi vai trò.
- Không cho tự khóa/tự đổi vai trò/tự xóa tài khoản đang đăng nhập.
- Không cho xóa Chủ xe hoạt động cuối cùng.
- Tài khoản chưa có lịch sử có thể xóa; đã có lịch sử phải Lưu trữ.

## 9. Tin tức

- Tạo bản nháp, đăng, ẩn.
- Chọn ảnh từ máy JPG/JPEG/PNG/WEBP <= 5 MB; thử URL ảnh HTTPS.
- Ảnh > 5 MB hoặc định dạng khác phải bị chặn.
- Mở bài công khai và kiểm tra lượt xem tăng.
- Xóa mềm bài; bài không còn trong danh sách quản trị/công khai nhưng lịch sử DB vẫn giữ.

## 10. Nhật ký và phân quyền

- Nhật ký: lọc từ khóa, hành động, đối tượng, vai trò, từ ngày/đến ngày.
- Kiểm tra các thao tác quan trọng có log: vé, thu tiền/hoàn tác, khách hàng, tài khoản, tin tức, chuyến.
- STAFF không được truy cập chức năng chỉ dành cho Chủ xe như quản lý tài khoản/thống kê nếu permission không cấp.

Nếu tất cả mục trên đạt và `npm test` + `npm run build` đều PASS, có thể xem bản port MVC → Node.js hoàn tất ở mức chức năng hiện tại.
