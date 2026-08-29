-- Kiến trúc địa điểm mới: Chuyến xe tham chiếu trực tiếp địa điểm cụ thể.
-- Route/Tuyến cũ được giữ làm dữ liệu legacy, nhưng không còn bắt buộc khi tạo chuyến mới.
ALTER TABLE "trips" ALTER COLUMN "route_id" DROP NOT NULL;
