const AUDIT_ACTION_LABELS = {
  LOGIN: 'Đăng nhập hệ thống',
  LOGIN_ADMIN: 'Đăng nhập trang quản trị',
  ADMIN_LOGIN: 'Đăng nhập trang quản trị',
  USER_LOGIN: 'Đăng nhập tài khoản',

  CREATE_BUS: 'Thêm xe mới',
  UPDATE_BUS: 'Cập nhật thông tin xe',
  DELETE_BUS: 'Xóa xe',
  CHANGE_BUS_STATUS: 'Đổi trạng thái xe',

  CREATE_ROUTE: 'Thêm tuyến đường',
  UPDATE_ROUTE: 'Cập nhật tuyến đường',
  DELETE_ROUTE: 'Xóa tuyến đường',
  CHANGE_ROUTE_STATUS: 'Đổi trạng thái tuyến đường',

  CREATE_TRIP: 'Tạo chuyến xe',
  UPDATE_TRIP: 'Cập nhật chuyến xe',
  UPDATE_TRIP_STATUS: 'Đổi trạng thái chuyến xe',
  CHANGE_TRIP_STATUS: 'Đổi trạng thái chuyến xe',
  CANCEL_TRIP: 'Hủy chuyến xe',

  HOLD_SEAT: 'Giữ ghế',
  HOLD_SEATS: 'Giữ ghế',
  RELEASE_SEAT: 'Giải phóng ghế',
  RELEASE_SEATS: 'Giải phóng ghế',

  CREATE_BOOKING: 'Tạo vé xe',
  UPDATE_BOOKING: 'Cập nhật vé xe',
  UPDATE_BOOKING_CONTACT: 'Cập nhật thông tin hành khách',
  CANCEL_BOOKING: 'Hủy vé xe',
  DELETE_BOOKING: 'Xóa mềm vé xe',
  MARK_NO_SHOW: 'Đánh dấu khách không đi',
  COMPLETE_BOOKING: 'Hoàn thành vé xe',

  CREATE_PAYMENT: 'Tạo thanh toán',
  UPDATE_PAYMENT: 'Cập nhật thanh toán',
  PAYMENT_SUCCESS: 'Ghi nhận thanh toán thành công',
  PAYMENT_PENDING: 'Hoàn tác xác nhận thu tiền',
  COMPLETE_PAYMENT: 'Hoàn tất thanh toán',
  REFUND_PAYMENT: 'Hoàn tiền',

  CREATE_CUSTOMER: 'Tạo hồ sơ khách hàng',
  UPDATE_CUSTOMER: 'Cập nhật khách hàng',
  BLOCK_CUSTOMER: 'Khóa khách hàng',
  UNBLOCK_CUSTOMER: 'Mở khóa khách hàng',
  ARCHIVE_CUSTOMER: 'Lưu trữ khách hàng',
  DELETE_CUSTOMER: 'Xóa khách hàng',

  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER: 'Cập nhật tài khoản',
  CHANGE_USER_STATUS: 'Đổi trạng thái tài khoản',
  CHANGE_USER_ROLE: 'Đổi quyền tài khoản',

  CREATE_NEWS: 'Tạo tin tức',
  UPDATE_NEWS: 'Cập nhật tin tức',
  UPDATE_NEWS_STATUS: 'Đổi trạng thái tin tức',
  PUBLISH_NEWS: 'Đăng tin tức',
  UNPUBLISH_NEWS: 'Ẩn tin tức',
  DELETE_NEWS: 'Xóa tin tức',
}

const AUDIT_ENTITY_LABELS = {
  AUTH: 'Đăng nhập',
  SYSTEM: 'Hệ thống',
  USER: 'Tài khoản',
  CUSTOMER: 'Khách hàng',
  BUS: 'Xe',
  SEAT: 'Ghế',
  ROUTE: 'Tuyến đường',
  TRIP: 'Chuyến xe',
  TRIP_SEAT: 'Ghế của chuyến',
  BOOKING: 'Vé xe',
  BOOKING_ITEM: 'Chi tiết vé',
  PAYMENT: 'Thanh toán',
  NEWS: 'Tin tức',
}

const ROLE_LABELS = {
  ADMIN: 'Chủ xe',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
  SYSTEM: 'Hệ thống',
}

const DESCRIPTION_REPLACEMENTS = [
  [/\bNO_SHOW\b/g, 'Không đi'],
  [/\bPAY_AT_BUS\b/g, 'Thanh toán tại nhà xe'],
  [/\bBANK_TRANSFER\b/g, 'Chuyển khoản ngân hàng'],
  [/\bBANK_QR\b/g, 'QR ngân hàng'],
  [/\bCASH_COUNTER\b/g, 'Tiền mặt tại quầy'],
  [/\bCOUNTER_CASH\b/g, 'Tiền mặt tại quầy'],
  [/\bCARD_POS\b/g, 'Thẻ/POS'],

  [/\bCONFIRMED\b/g, 'Đã đặt'],
  [/\bPENDING\b/g, 'Chờ xử lý'],
  [/\bCANCELLED\b/g, 'Đã hủy'],
  [/\bEXPIRED\b/g, 'Hết hạn'],
  [/\bCOMPLETED\b/g, 'Đã hoàn thành'],
  [/\bDELETED\b/g, 'Đã xóa'],

  [/\bDEPARTED\b/g, 'Đã khởi hành'],
  [/\bCLOSED\b/g, 'Đã đóng đặt vé'],
  [/\bOPEN\b/g, 'Đang mở bán'],

  [/\bBLOCKED\b/g, 'Đã khóa'],
  [/\bARCHIVED\b/g, 'Lưu trữ'],
  [/\bINACTIVE\b/g, 'Ngừng hoạt động'],
  [/\bACTIVE\b/g, 'Hoạt động'],

  [/\bREFUNDED\b/g, 'Đã hoàn tiền'],
  [/\bSUCCESS\b/g, 'Thành công'],
  [/\bFAILED\b/g, 'Thất bại'],

  [/\bADMIN\b/g, 'Chủ xe'],
  [/\bSTAFF\b/g, 'Nhân viên'],
  [/\bCUSTOMER\b/g, 'Khách hàng'],

  [/\bONLINE\b/g, 'Trực tuyến'],
  [/\bHOTLINE\b/g, 'Hotline'],
  [/\bCOUNTER\b/g, 'Tại quầy'],

  [/\bbooking\b/gi, 'vé'],
]

const normalizeCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()

const getAuditActionLabel = (action) => {
  const normalized =
    normalizeCode(action)

  if (!normalized) {
    return 'Chưa xác định'
  }

  return (
    AUDIT_ACTION_LABELS[
      normalized
    ] || 'Thao tác hệ thống'
  )
}

const getAuditEntityLabel = (
  entityType,
) => {
  const normalized =
    normalizeCode(entityType)

  if (!normalized) {
    return 'Chưa xác định'
  }

  return (
    AUDIT_ENTITY_LABELS[
      normalized
    ] || 'Đối tượng hệ thống'
  )
}

const getRoleLabel = (role) => {
  const normalized =
    normalizeCode(role)

  if (!normalized) {
    return 'Hệ thống'
  }

  return (
    ROLE_LABELS[normalized] ||
    'Vai trò khác'
  )
}

const translateAuditDescription = (
  description,
) => {
  if (!description) {
    return 'Không có mô tả'
  }

  return DESCRIPTION_REPLACEMENTS.reduce(
    (
      translatedDescription,
      [pattern, replacement],
    ) =>
      translatedDescription.replace(
        pattern,
        replacement,
      ),
    String(description),
  )
}

export {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  getAuditActionLabel,
  getAuditEntityLabel,
  getRoleLabel,
  ROLE_LABELS,
  translateAuditDescription,
}