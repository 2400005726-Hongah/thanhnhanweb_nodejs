import { Router } from 'express'

import { PERMISSIONS } from '../config/permissions.js'
import {
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
} from '../controllers/admin.controller.js'
import {
  authenticate,
  authorizePermissions,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  auditLogValidator,
  bookingCodeValidator,
  cancelManagedBookingValidator,
  changeUserRoleValidator,
  changeUserStatusValidator,
  createManagedUserValidator,
  listCustomersValidator,
  listManagedBookingsValidator,
  listUsersValidator,
  markNoShowValidator,
  revenueValidator,
  updateBookingContactValidator,
  updateCustomerValidator,
} from '../validators/admin.validator.js'

const router = Router()

router.use(authenticate)

router.get(
  '/dashboard/summary',
  authorizePermissions(PERMISSIONS.VIEW_OPERATION_DASHBOARD),
  dashboardSummary,
)
router.get(
  '/revenue/summary',
  authorizePermissions(PERMISSIONS.VIEW_REVENUE),
  revenueValidator,
  validate,
  revenueSummary,
)

router.get(
  '/bookings',
  authorizePermissions(PERMISSIONS.VIEW_BOOKINGS),
  listManagedBookingsValidator,
  validate,
  listBookings,
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
  '/bookings/:bookingCode/cancel',
  authorizePermissions(PERMISSIONS.MANAGE_BOOKINGS),
  cancelManagedBookingValidator,
  validate,
  cancelBooking,
)
router.post(
  '/bookings/:bookingCode/no-show',
  authorizePermissions(PERMISSIONS.MARK_NO_SHOW),
  markNoShowValidator,
  validate,
  markNoShow,
)

router.get(
  '/customers',
  authorizePermissions(PERMISSIONS.VIEW_CUSTOMERS),
  listCustomersValidator,
  validate,
  listCustomers,
)
router.patch(
  '/customers/:id',
  authorizePermissions(PERMISSIONS.EDIT_CUSTOMERS),
  updateCustomerValidator,
  validate,
  editCustomer,
)

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

router.get(
  '/audit-logs',
  authorizePermissions(PERMISSIONS.VIEW_SYSTEM_LOGS),
  auditLogValidator,
  validate,
  showAuditLogs,
)

export default router
