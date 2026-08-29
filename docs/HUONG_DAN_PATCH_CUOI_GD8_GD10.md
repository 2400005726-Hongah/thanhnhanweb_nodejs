# Hướng dẫn áp dụng patch cuối GĐ8 → GĐ10

Patch này được tạo trên nền **GĐ7B đã PASS**. Nó chứa toàn bộ thay đổi của GĐ8, GĐ9 và GĐ10, vì vậy chỉ cần chép một lần.

## Cách áp dụng

1. Sao lưu thư mục dự án hiện tại.
2. Giải nén patch.
3. Chép đè các thư mục `backend`, `frontend`, `docs` vào:

```text
D:\Đồ án NODE  JS\
```

4. Không xóa `.env` hiện tại; patch không chứa `.env`.
5. Không chạy `prisma migrate reset`.
6. Khi đã sẵn sàng kiểm thử cuối, chạy:

```powershell
cd "D:\Đồ án NODE  JS\backend"
npm run db:validate
npm run db:generate
npm run db:migrate
npm test

cd "D:\Đồ án NODE  JS\frontend"
npm run build
```

Migration mới là `20260811000100_admin_parity` và chỉ bổ sung enum/cột cần thiết, không xóa dữ liệu.

Xem `docs/FINAL_TEST_CHECKLIST.md` để kiểm thử toàn bộ chức năng một lần sau khi hoàn tất.
