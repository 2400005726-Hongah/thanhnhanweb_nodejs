# Trạng thái chuyển đổi MongoDB

Backend đã chuyển hoàn toàn sang Prisma và Supabase PostgreSQL. Các model Mongoose cũ đã được xóa sau khi xác nhận không còn file application hoặc test nào import chúng.

Thông tin kết nối MongoDB cũ không còn được ứng dụng sử dụng. Không đưa URI hoặc credential cũ vào tài liệu hay source control.
