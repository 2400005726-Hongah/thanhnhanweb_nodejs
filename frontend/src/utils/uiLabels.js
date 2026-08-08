const STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  BLOCKED: 'Đã khóa',
  OPEN: 'Đang mở bán',
  CLOSED: 'Ngừng bán',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã đặt',
  EXPIRED: 'Hết hạn',
  NO_SHOW: 'Không đi',
  DELETED: 'Đã xóa',
  SUCCESS: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
  FAILED: 'Thất bại',
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã đăng',
}

const getStatusLabel = (status) =>
  STATUS_LABELS[String(status || '').toUpperCase()] ||
  status ||
  'Chưa xác định'

export { getStatusLabel, STATUS_LABELS }
