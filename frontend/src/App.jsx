import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import CustomerLayout from './layouts/CustomerLayout.jsx'
import BookingPage from './pages/BookingPage.jsx'
import BookingPaymentPage from './pages/BookingPaymentPage.jsx'
import BookingServicePointPage from './pages/BookingServicePointPage.jsx'
import BookingSuccessPage from './pages/BookingSuccessPage.jsx'
import InfoPage from './pages/InfoPage.jsx'
import NewsDetailPage from './pages/NewsDetailPage.jsx'
import NewsListPage from './pages/NewsListPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import SearchTripsPage from './pages/SearchTripsPage.jsx'
import TicketLookupPage from './pages/TicketLookupPage.jsx'
import TripDetailPage from './pages/TripDetailPage.jsx'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage.jsx'
import AdminBookingCreatePage from './pages/admin/AdminBookingCreatePage.jsx'
import AdminBookingDetailPage from './pages/admin/AdminBookingDetailPage.jsx'
import AdminBookingsPage from './pages/admin/AdminBookingsPage.jsx'
import AdminBookingEditPage from './pages/admin/AdminBookingEditPage.jsx'
import AdminBookingDeletePage from './pages/admin/AdminBookingDeletePage.jsx'
import AdminBusesPage from './pages/admin/AdminBusesPage.jsx'
import AdminBusFormPage from './pages/admin/AdminBusFormPage.jsx'
import AdminBusDeletePage from './pages/admin/AdminBusDeletePage.jsx'
import AdminCustomerDetailPage from './pages/admin/AdminCustomerDetailPage.jsx'
import AdminCustomerEditPage from './pages/admin/AdminCustomerEditPage.jsx'
import AdminCustomerDeletePage from './pages/admin/AdminCustomerDeletePage.jsx'
import AdminCustomersPage from './pages/admin/AdminCustomersPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminLocationsPage from './pages/admin/AdminLocationsPage.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminNewsPage from './pages/admin/AdminNewsPage.jsx'
import AdminNewsFormPage from './pages/admin/AdminNewsFormPage.jsx'
import AdminNewsDeletePage from './pages/admin/AdminNewsDeletePage.jsx'
import AdminRevenuePage from './pages/admin/AdminRevenuePage.jsx'
import AdminTicketLookupPage from './pages/admin/AdminTicketLookupPage.jsx'
import AdminTripPassengersPage from './pages/admin/AdminTripPassengersPage.jsx'
import AdminTripServicePointsPage from './pages/admin/AdminTripServicePointsPage.jsx'
import AdminTripSeatsPage from './pages/admin/AdminTripSeatsPage.jsx'
import AdminTripDeletePage from './pages/admin/AdminTripDeletePage.jsx'
import AdminTripsRoutesPage from './pages/admin/AdminTripsRoutesPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import AdminUserFormPage from './pages/admin/AdminUserFormPage.jsx'
import AdminUserDeletePage from './pages/admin/AdminUserDeletePage.jsx'
import { PERMISSIONS } from './utils/adminPermissions.js'
import './App.css'
import './mvc-theme.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<HomePage />} />

            <Route
              path="/tim-chuyen"
              element={<SearchTripsPage />}
            />

            <Route
              path="/tra-cuu-ve"
              element={<TicketLookupPage />}
            />

            <Route
              path="/chuyen-xe/:tripId"
              element={<TripDetailPage />}
            />

            <Route
              path="/dat-ve/:tripId"
              element={<BookingServicePointPage />}
            />

            <Route
              path="/dat-ve/:tripId/thong-tin"
              element={<BookingPage />}
            />

            <Route
              path="/dat-ve/:tripId/thanh-toan"
              element={<BookingPaymentPage />}
            />

            <Route
              path="/dat-ve-thanh-cong/:bookingCode"
              element={<BookingSuccessPage />}
            />

            <Route path="/thong-tin/:feature" element={<InfoPage />} />
            <Route path="/tin-tuc" element={<NewsListPage />} />
            <Route path="/tin-tuc/:id" element={<NewsDetailPage />} />


            <Route
              path="*"
              element={<NotFoundPage />}
            />
          </Route>

          <Route path="/admin/dang-nhap" element={<AdminLoginPage />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />}>
            <Route
              path="/admin"
              element={<AdminLayout />}
            >
              <Route
                index
                element={<AdminDashboardPage />}
              />

              <Route
                path="xe"
                element={<AdminBusesPage />}
              />

              <Route
                element={<ProtectedRoute requiredPermissions={[PERMISSIONS.MANAGE_BUSES]} />}
              >
                <Route path="xe/them" element={<AdminBusFormPage mode="create" />} />
                <Route path="xe/:id/sua" element={<AdminBusFormPage mode="edit" />} />
                <Route path="xe/:id/xoa" element={<AdminBusDeletePage />} />
              </Route>

              <Route
                path="chuyen-xe"
                element={<AdminTripsRoutesPage />}
              />

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.CREATE_TRIPS]}
                  />
                }
              >
                <Route
                  path="chuyen-xe/them"
                  element={<AdminTripsRoutesPage pageMode="create" />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.EDIT_TRIPS]}
                  />
                }
              >
                <Route
                  path="chuyen-xe/:tripId/sua"
                  element={<AdminTripsRoutesPage pageMode="edit" />}
                />
              </Route>

              <Route
                element={<ProtectedRoute requiredPermissions={[PERMISSIONS.DELETE_TRIPS]} />}
              >
                <Route path="chuyen-xe/:tripId/huy" element={<AdminTripDeletePage />} />
              </Route>

              <Route
                path="tuyen-xe"
                element={<Navigate replace to="/admin/chuyen-xe#tuyen-xe-dang-khai-thac" />}
              />

              <Route
                path="chuyen-xe/:tripId/so-do-ghe"
                element={<AdminTripSeatsPage />}
              />

              <Route
                path="chuyen-xe/:tripId/hanh-khach"
                element={<AdminTripPassengersPage />}
              />

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.EDIT_TRIPS]}
                  />
                }
              >
                <Route
                  path="chuyen-xe/:tripId/diem-don-tra"
                  element={<AdminTripServicePointsPage />}
                />
              </Route>

              <Route
                path="ve-xe"
                element={<AdminBookingsPage />}
              />

              <Route
                path="ve-xe/:bookingCode"
                element={<AdminBookingDetailPage />}
              />

              <Route
                element={<ProtectedRoute requiredPermissions={[PERMISSIONS.MANAGE_BOOKINGS]} />}
              >
                <Route path="ve-xe/:bookingCode/sua" element={<AdminBookingEditPage />} />
                <Route path="ve-xe/:bookingCode/xoa" element={<AdminBookingDeletePage />} />
              </Route>

              <Route
                path="kiem-tra-ve"
                element={<AdminTicketLookupPage />}
              />

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.MANAGE_BOOKINGS]}
                  />
                }
              >
                <Route
                  path="dat-ve-hotline/:tripId"
                  element={
                    <AdminBookingCreatePage source="HOTLINE" />
                  }
                />

                <Route
                  path="dat-ve-tai-quay/:tripId"
                  element={
                    <AdminBookingCreatePage source="COUNTER" />
                  }
                />
              </Route>

              <Route
                path="khach-hang"
                element={<AdminCustomersPage />}
              />

              <Route
                path="khach-hang/:id"
                element={<AdminCustomerDetailPage />}
              />

              <Route
                element={<ProtectedRoute requiredPermissions={[PERMISSIONS.EDIT_CUSTOMERS]} />}
              >
                <Route path="khach-hang/:id/sua" element={<AdminCustomerEditPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="khach-hang/:id/xoa" element={<AdminCustomerDeletePage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.EDIT_ROUTES]}
                  />
                }
              >
                <Route path="dia-diem" element={<AdminLocationsPage />} />
              </Route>

              <Route
                path="tin-tuc"
                element={<AdminNewsPage />}
              />

              <Route path="tin-tuc/them" element={<AdminNewsFormPage mode="create" />} />
              <Route path="tin-tuc/:id/sua" element={<AdminNewsFormPage mode="edit" />} />
              <Route path="tin-tuc/:id/xoa" element={<AdminNewsDeletePage />} />

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.VIEW_REVENUE]}
                  />
                }
              >
                <Route
                  path="thong-ke"
                  element={<AdminRevenuePage />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.MANAGE_USERS]}
                  />
                }
              >
                <Route
                  path="tai-khoan"
                  element={<AdminUsersPage />}
                />

                <Route path="tai-khoan/them" element={<AdminUserFormPage mode="create" />} />
                <Route path="tai-khoan/:id/sua" element={<AdminUserFormPage mode="edit" />} />
                <Route path="tai-khoan/:id/xoa" element={<AdminUserDeletePage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.VIEW_SYSTEM_LOGS]}
                  />
                }
              >
                <Route
                  path="nhat-ky"
                  element={<AdminAuditLogsPage />}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App