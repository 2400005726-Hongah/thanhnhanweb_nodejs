const printManualDataNotice = () => {
  const message =
    'Seed dữ liệu demo tuyến/chuyến kiểu cũ đã ngừng sử dụng. ' +
    'Hãy tạo Tỉnh/Thành → Bộ lọc → Địa điểm cụ thể → Chuyến xe từ trang quản trị để dữ liệu đúng kiến trúc mới.'

  console.log(message)
  return message
}

if (process.argv[1]?.endsWith('seedManualDataNotice.js')) {
  printManualDataNotice()
}

export { printManualDataNotice }
