import {
  lookupBooking as lookupBookingService,
  simulatePayment as simulatePaymentService,
} from '../services/payment.service.js'

const simulatePayment = async (request, response, next) => {
  try {
    const data = await simulatePaymentService({
      bookingCode: request.params.bookingCode,
      phone: request.body.phone,
      paymentMethod: request.body.paymentMethod,
    })
    response.status(201).json({
      success: true,
      message: 'Thanh toán thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const lookupBooking = async (request, response, next) => {
  try {
    const data = await lookupBookingService(request.query)
    response.status(200).json({
      success: true,
      message: 'Tra cứu booking thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export { lookupBooking, simulatePayment }
