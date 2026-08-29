import { Router } from 'express'

import { PERMISSIONS } from '../config/permissions.js'
import {
  cancelBooking,
  collectBookingPayment,
  changeAccountRole,
  changeAccountStatus,
  editAccount,
  changeCustomerStatus,
  createAccount,
  dashboardSummary,
  deleteAccount,
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
  deleteBooking,
} from '../controllers/admin.controller.js'
import { createManagedBooking } from '../controllers/booking.controller.js'
import {
  authenticate,
  authorizePermissions,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  auditLogValidator,
  bookingCodeValidator,
  collectManagedPaymentValidator,
  cancelManagedBookingValidator,
  changeCustomerStatusValidator,
  changeUserRoleValidator,
  changeUserStatusValidator,
  createManagedUserValidator,
  customerIdValidator,
  listCustomersValidator,
  listManagedBookingsValidator,
  listUsersValidator,
  markNoShowValidator,
  revenueValidator,
  undoManagedPaymentValidator,
  updateBookingContactValidator,
  updateCustomerValidator,
  updateManagedUserValidator,
  userIdValidator,
  deleteManagedBookingValidator,
} from '../validators/admin.validator.js'
import { createManagedBookingValidator } from '../validators/booking.validator.js'

const router = Router()

router.use(authenticate)

/*
 * Dashboard và doanh thu
 */
router.get(
  '/dashboard/summary',
  authorizePermissions(
    PERMISSIONS.VIEW_OPERATION_DASHBOARD,
  ),
  dashboardSummary,
)

router.get(
  '/revenue/summary',
  authorizePermissions(PERMISSIONS.VIEW_REVENUE),
  revenueValidator,
  validate,
  revenueSummary,
)

/*
 * Quản lý vé
 */
router.get(
  '/bookings',
  authorizePermissions(PERMISSIONS.VIEW_BOOKINGS),
  listManagedBookingsValidator,
  validate,
  listBookings,
)

router.get(
  '/bookings/export.xlsx',
  authorizePermissions(PERMISSIONS.VIEW_BOOKINGS),
  listManagedBookingsValidator,
  validate,
  exportBookingsExcel,
)

router.post(
  '/bookings',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  createManagedBookingValidator,
  validate,
  createManagedBooking,
)


router.get(
  '/bookings/lookup',
  authorizePermissions(PERMISSIONS.VIEW_BOOKINGS),
  lookupBooking,
)

router.get(
  '/bookings/:bookingCode',
  authorizePermissions(PERMISSIONS.VIEW_BOOKINGS),
  bookingCodeValidator,
  validate,
  showBooking,
)

router.patch(
  '/bookings/:bookingCode/contact',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  updateBookingContactValidator,
  validate,
  editBookingContact,
)


router.post(
  '/bookings/:bookingCode/resend-email',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  bookingCodeValidator,
  validate,
  resendTicketEmail,
)

router.post(
  '/bookings/:bookingCode/cancel',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  cancelManagedBookingValidator,
  validate,
  cancelBooking,
)

router.post(
  '/bookings/:bookingCode/delete',
  authorizePermissions(
    PERMISSIONS.MANAGE_BOOKINGS,
  ),
  deleteManagedBookingValidator,
  validate,
  deleteBooking,
)

router.post(
  '/bookings/:bookingCode/no-show',
  authorizePermissions(PERMISSIONS.MARK_NO_SHOW),
  markNoShowValidator,
  validate,
  markNoShow,
)


router.post(
  '/bookings/:bookingCode/collect-payment',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  collectManagedPaymentValidator,
  validate,
  collectBookingPayment,
)

router.post(
  '/bookings/:bookingCode/undo-payment',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  undoManagedPaymentValidator,
  validate,
  undoBookingPayment,
)

/*
 * Quản lý khách hàng
 */
router.get(
  '/customers',
  authorizePermissions(PERMISSIONS.VIEW_CUSTOMERS),
  listCustomersValidator,
  validate,
  listCustomers,
)

router.get(
  '/customers/export.xlsx',
  authorizePermissions(PERMISSIONS.EXPORT_DATA),
  exportCustomersExcel,
)

router.get(
  '/customers/:id',
  authorizePermissions(PERMISSIONS.VIEW_CUSTOMERS),
  customerIdValidator,
  validate,
  showCustomer,
)

router.patch(
  '/customers/:id',
  authorizePermissions(PERMISSIONS.EDIT_CUSTOMERS),
  updateCustomerValidator,
  validate,
  editCustomer,
)

router.patch(
  '/customers/:id/status',
  authorizePermissions(
    PERMISSIONS.MANAGE_CUSTOMER_STATUS,
  ),
  changeCustomerStatusValidator,
  validate,
  changeCustomerStatus,
)

router.delete(
  '/customers/:id',
  authorizePermissions(PERMISSIONS.ARCHIVE_CUSTOMERS),
  customerIdValidator,
  validate,
  archiveCustomerProfile,
)

/*
 * Quản lý tài khoản ADMIN và STAFF
 */
router.get(
  '/users',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  listUsersValidator,
  validate,
  listAccounts,
)

router.post(
  '/users',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  createManagedUserValidator,
  validate,
  createAccount,
)

router.patch(
  '/users/:id',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  updateManagedUserValidator,
  validate,
  editAccount,
)

router.delete(
  '/users/:id',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  userIdValidator,
  validate,
  deleteAccount,
)

router.patch(
  '/users/:id/status',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  changeUserStatusValidator,
  validate,
  changeAccountStatus,
)

router.patch(
  '/users/:id/role',
  authorizePermissions(PERMISSIONS.MANAGE_USERS),
  changeUserRoleValidator,
  validate,
  changeAccountRole,
)

/*
 * Nhật ký hệ thống
 */
router.get(
  '/audit-logs',
  authorizePermissions(PERMISSIONS.VIEW_SYSTEM_LOGS),
  auditLogValidator,
  validate,
  showAuditLogs,
)

export default router