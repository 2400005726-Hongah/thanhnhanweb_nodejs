import {
  changeUserRole as changeUserRoleService,
  changeUserStatus as changeUserStatusService,
  archiveCustomer,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  getDashboardSummary,
  getManagedBooking,
  lookupManagedBookingByIdentifier,
  getRevenueSummary,
  listAuditLogs,
  listCustomers as listCustomersService,
  listCustomersForExport,
  listManagedBookings,
  listManagedBookingsForExport,
  listUsers,
  markBookingNoShow,
  updateBookingContact,
  updateCustomer,
} from '../services/admin.service.js'

import { createBookingExcelWorkbook } from '../services/bookingExcel.service.js'
import { createCustomerExcelWorkbook } from '../services/customerExcel.service.js'

import {
  softDeleteManagedBooking,
} from '../services/bookingDeletion.service.js'

import * as cancellationService from '../services/cancellation.service.js'

import {
  confirmCollectedPayment,
  undoCollectedPayment,
} from '../services/paymentCollection.service.js'

const dashboardSummary = async (request, response, next) => {
  try {
    const summary = await getDashboardSummary(request.user.role)

    response.status(200).json({
      success: true,
      message: 'Lấy tổng quan vận hành thành công',
      data: { summary },
    })
  } catch (error) {
    next(error)
  }
}


const revenueSummary = async (request, response, next) => {
  try {
    const summary = await getRevenueSummary(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy thống kê doanh thu thành công',
      data: { summary },
    })
  } catch (error) {
    next(error)
  }
}

const listBookings = async (request, response, next) => {
  try {
    const data = await listManagedBookings(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách vé thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const exportBookingsExcel = async (request, response, next) => {
  try {
    const bookings = await listManagedBookingsForExport(request.query)
    const workbook = createBookingExcelWorkbook(bookings)
    const timestamp = new Date().toISOString().slice(0, 16).replaceAll(/[-:T]/g, '')
    const fileName = `DanhSachVe_${timestamp}.xlsx`

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    )
    response.status(200).send(workbook)
  } catch (error) {
    next(error)
  }
}


const lookupBooking = async (request, response, next) => {
  try {
    const booking = await lookupManagedBookingByIdentifier(request.query.identifier)
    response.status(200).json({
      success: true,
      message: 'Tra cứu vé thành công',
      data: { booking },
    })
  } catch (error) {
    next(error)
  }
}

const showBooking = async (request, response, next) => {
  try {
    const booking = await getManagedBooking(request.params.bookingCode)
    response.status(200).json({
      success: true,
      message: 'Lấy chi tiết vé thành công',
      data: { booking },
    })
  } catch (error) {
    next(error)
  }
}

const editBookingContact = async (request, response, next) => {
  try {
    const booking = await updateBookingContact(
      request.params.bookingCode,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật thông tin vé thành công',
      data: { booking },
    })
  } catch (error) {
    next(error)
  }
}

const cancelBooking = async (request, response, next) => {
  try {
    const cancellation = await cancellationService.cancelManagedBooking({
      bookingCode: request.params.bookingCode,
      actor: request.user,
      reason: request.body.reason,
    })
    response.status(200).json({
      success: true,
      message: 'Hủy vé thành công',
      data: { cancellation },
    })
  } catch (error) {
    next(error)
  }
}

const deleteBooking = async (
  request,
  response,
  next,
) => {
  try {
    const deletion =
      await softDeleteManagedBooking({
        bookingCode:
          request.params.bookingCode,

        reason:
          request.body.reason,

        actor:
          request.user,
      })

    response.status(200).json({
      success: true,
      message:
        'Xóa mềm vé thành công',

      data: {
        deletion,
      },
    })
  } catch (error) {
    next(error)
  }
}


const collectBookingPayment = async (request, response, next) => {
  try {
    const payment = await confirmCollectedPayment({
      bookingCode: request.params.bookingCode,
      actor: request.user,
      confirmed: request.body.confirmed,
    })

    response.status(200).json({
      success: true,
      message: 'Đã xác nhận thu tiền của vé',
      data: { payment },
    })
  } catch (error) {
    next(error)
  }
}

const undoBookingPayment = async (request, response, next) => {
  try {
    const payment = await undoCollectedPayment({
      bookingCode: request.params.bookingCode,
      actor: request.user,
      reason: request.body.reason,
    })

    response.status(200).json({
      success: true,
      message: 'Đã hoàn tác xác nhận thu tiền của vé',
      data: { payment },
    })
  } catch (error) {
    next(error)
  }
}

const markNoShow = async (request, response, next) => {
  try {
    const booking = await markBookingNoShow(
      request.params.bookingCode,
      request.body.reason,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Đã đánh dấu khách Không đi',
      data: { booking },
    })
  } catch (error) {
    next(error)
  }
}


const resendTicketEmail = async (request, response, next) => {
  try {
    const { resendBookingEmail } = await import(
      '../services/bookingEmail.service.js'
    )

    const delivery = await resendBookingEmail(
      request.params.bookingCode,
      request.user,
    )

    response.status(200).json({
      success: true,
      message: delivery.emailSent
        ? 'Đã gửi lại email vé điện tử'
        : delivery.emailWarning || 'Chưa thể gửi email vé điện tử',
      data: { delivery },
    })
  } catch (error) {
    next(error)
  }
}

const exportCustomersExcel = async (request, response, next) => {
  try {
    const customers = await listCustomersForExport()
    const workbook = createCustomerExcelWorkbook(customers)
    const fileName = `DanhSachKhachHang_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.xlsx`
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    response.status(200).send(workbook)
  } catch (error) {
    next(error)
  }
}

const archiveCustomerProfile = async (request, response, next) => {
  try {
    const result = await archiveCustomer(request.params.id, request.user)
    response.status(200).json({
      success: true,
      message: result.deleted
        ? 'Đã xóa khách hàng chưa có lịch sử vé'
        : 'Đã lưu trữ khách hàng; lịch sử vé vẫn được giữ',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

const listCustomers = async (request, response, next) => {
  try {
    const data = await listCustomersService(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách khách hàng thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const showCustomer = async (
  request,
  response,
  next,
) => {
  try {
    const { getCustomerDetail } = await import(
      '../services/admin.service.js'
    )

    const data = await getCustomerDetail(
      request.params.id,
      request.query,
      request.user,
    )

    response.status(200).json({
      success: true,
      message:
        'Lấy chi tiết khách hàng thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const changeCustomerStatus = async (
  request,
  response,
  next,
) => {
  try {
    const { changeCustomerStatus: changeCustomerStatusService } = await import(
      '../services/admin.service.js'
    )

    const customer =
      await changeCustomerStatusService(
        request.params.id,
        request.body.status,
        request.body.reason,
        request.user,
      )

    response.status(200).json({
      success: true,

      message:
        request.body.status === 'BLOCKED'
          ? 'Đã khóa khách hàng'
          : 'Đã mở khóa khách hàng',

      data: {
        customer,
      },
    })
  } catch (error) {
    next(error)
  }
}

const editCustomer = async (request, response, next) => {
  try {
    const customer = await updateCustomer(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật khách hàng thành công',
      data: { customer },
    })
  } catch (error) {
    next(error)
  }
}

const listAccounts = async (request, response, next) => {
  try {
    const data = await listUsers(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách tài khoản thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const createAccount = async (request, response, next) => {
  try {
    const user = await createManagedUser(request.body, request.user)
    response.status(201).json({
      success: true,
      message: 'Tạo tài khoản quản trị thành công',
      data: { user },
    })
  } catch (error) {
    next(error)
  }
}

const editAccount = async (request, response, next) => {
  try {
    const user = await updateManagedUser(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản thành công',
      data: { user },
    })
  } catch (error) {
    next(error)
  }
}

const deleteAccount = async (request, response, next) => {
  try {
    const result = await deleteManagedUser(request.params.id, request.user)
    response.status(200).json({
      success: true,
      message: result.deleted
        ? 'Đã xóa tài khoản quản trị'
        : 'Đã lưu trữ tài khoản quản trị để bảo toàn lịch sử',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

const changeAccountStatus = async (request, response, next) => {
  try {
    const user = await changeUserStatusService(
      request.params.id,
      request.body.status,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái tài khoản thành công',
      data: { user },
    })
  } catch (error) {
    next(error)
  }
}

const changeAccountRole = async (request, response, next) => {
  try {
    const user = await changeUserRoleService(
      request.params.id,
      request.body.role,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật quyền tài khoản thành công',
      data: { user },
    })
  } catch (error) {
    next(error)
  }
}

const showAuditLogs = async (request, response, next) => {
  try {
    const data = await listAuditLogs(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy nhật ký hệ thống thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export {
  cancelBooking,
  collectBookingPayment,
  changeAccountRole,
  changeAccountStatus,
  editAccount,
  changeCustomerStatus,
  createAccount,
  dashboardSummary,
  deleteAccount,
  deleteBooking,
  editBookingContact,
  editCustomer,
  exportCustomersExcel,
  archiveCustomerProfile,
  exportBookingsExcel,
  listAccounts,
  listBookings,
  lookupBooking,
  listCustomers,
  markNoShow,
  revenueSummary,
  resendTicketEmail,
  showAuditLogs,
  showBooking,
  showCustomer,
  undoBookingPayment,
}
