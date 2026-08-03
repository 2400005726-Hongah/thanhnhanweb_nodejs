const PAYMENT_STATUS_LABELS = Object.freeze({
  PENDING: 'Chưa thanh toán',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
})

const PAYMENT_METHOD_LABELS = Object.freeze({
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  BANK_QR: 'QR ngân hàng',
  MOMO: 'Ví MoMo',
  ZALOPAY: 'ZaloPay',
  VNPAY: 'VNPay',
  CARD_POS: 'Thẻ/POS',
  CASH_COUNTER: 'Tiền mặt tại quầy',
  PAY_AT_BUS: 'Thanh toán tại nhà xe',
  SIMULATED: 'Thanh toán mô phỏng',
  CASH: 'Tiền mặt',
  COUNTER_CASH: 'Tiền mặt tại quầy (cũ)',
  POS: 'Thẻ/POS (cũ)',
})

const PAYMENT_METHODS_BY_SOURCE = Object.freeze({
  ONLINE: Object.freeze([
    'BANK_TRANSFER',
    'BANK_QR',
    'MOMO',
    'ZALOPAY',
    'VNPAY',
    'PAY_AT_BUS',
    'SIMULATED',
  ]),
  HOTLINE: Object.freeze([
    'BANK_TRANSFER',
    'BANK_QR',
    'MOMO',
    'ZALOPAY',
    'VNPAY',
    'PAY_AT_BUS',
    'SIMULATED',
  ]),
  COUNTER: Object.freeze([
    'CASH_COUNTER',
    'BANK_TRANSFER',
    'BANK_QR',
    'MOMO',
    'ZALOPAY',
    'VNPAY',
    'CARD_POS',
    'PAY_AT_BUS',
  ]),
})

const getPaymentMethodLabel = (method) =>
  PAYMENT_METHOD_LABELS[method] || method || 'Chưa chọn'

const getPaymentStatusLabel = (status) =>
  PAYMENT_STATUS_LABELS[status] || status || 'Chưa xác định'

const getPaymentOptionsForSource = (source) =>
  (PAYMENT_METHODS_BY_SOURCE[source] || []).map((value) => ({
    value,
    label: getPaymentMethodLabel(value),
  }))

export {
  PAYMENT_METHODS_BY_SOURCE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  getPaymentMethodLabel,
  getPaymentOptionsForSource,
  getPaymentStatusLabel,
}
