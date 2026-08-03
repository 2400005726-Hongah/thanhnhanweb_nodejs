import HttpError from '../utils/HttpError.js'

const ELECTRONIC_PAYMENT_METHODS = Object.freeze([
  'BANK_TRANSFER',
  'BANK_QR',
  'MOMO',
  'ZALOPAY',
  'VNPAY',
])

const SOURCE_PAYMENT_METHODS = Object.freeze({
  ONLINE: Object.freeze([
    ...ELECTRONIC_PAYMENT_METHODS,
    'PAY_AT_BUS',
    'SIMULATED',
  ]),
  HOTLINE: Object.freeze([
    ...ELECTRONIC_PAYMENT_METHODS,
    'PAY_AT_BUS',
    'SIMULATED',
  ]),
  COUNTER: Object.freeze([
    'CASH_COUNTER',
    ...ELECTRONIC_PAYMENT_METHODS,
    'CARD_POS',
    'PAY_AT_BUS',
  ]),
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

const PAYMENT_STATUS_LABELS = Object.freeze({
  PENDING: 'Chưa thanh toán',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
})

const isPaymentMethodAllowed = (source, paymentMethod) =>
  SOURCE_PAYMENT_METHODS[source]?.includes(paymentMethod) || false

const assertPaymentMethodAllowed = (source, paymentMethod) => {
  if (!isPaymentMethodAllowed(source, paymentMethod)) {
    throw new HttpError(
      `Phương thức thanh toán ${paymentMethod || 'không xác định'} không hợp lệ với nguồn ${source}`,
      400,
    )
  }
}

export {
  ELECTRONIC_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SOURCE_PAYMENT_METHODS,
  assertPaymentMethodAllowed,
  isPaymentMethodAllowed,
}
