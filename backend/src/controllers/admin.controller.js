import {
  changeUserRole as changeUserRoleService,
  changeUserStatus as changeUserStatusService,
  createManagedUser,
  getDashboardSummary,
  getManagedBooking,
  getRevenueSummary,
  listAuditLogs,
  listManagedBookings,
  listUsers,
  markBookingNoShow,
  updateBookingContact,
  updateCustomer,
} from '../services/admin.service.js'
import * as cancellationService from '../services/cancellation.service.js'

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

const listCustomers = async (request, response, next) => {
  try {
    const data = await listUsers(request.query, ['CUSTOMER'])
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách khách hàng thành công',
      data,
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
  changeAccountRole,
  changeAccountStatus,
  createAccount,
  dashboardSummary,
  editBookingContact,
  editCustomer,
  listAccounts,
  listBookings,
  listCustomers,
  markNoShow,
  revenueSummary,
  showAuditLogs,
  showBooking,
}
