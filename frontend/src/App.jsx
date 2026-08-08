import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import CustomerLayout from './layouts/CustomerLayout.jsx'
import BookingPage from './pages/BookingPage.jsx'
import BookingSuccessPage from './pages/BookingSuccessPage.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'
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
import AdminBusesPage from './pages/admin/AdminBusesPage.jsx'
import AdminCustomerDetailPage from './pages/admin/AdminCustomerDetailPage.jsx'
import AdminCustomersPage from './pages/admin/AdminCustomersPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminLocationsPage from './pages/admin/AdminLocationsPage.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminNewsPage from './pages/admin/AdminNewsPage.jsx'
import AdminRevenuePage from './pages/admin/AdminRevenuePage.jsx'
import AdminTicketLookupPage from './pages/admin/AdminTicketLookupPage.jsx'
import AdminTripPassengersPage from './pages/admin/AdminTripPassengersPage.jsx'
import AdminTripSeatsPage from './pages/admin/AdminTripSeatsPage.jsx'
import AdminTripsRoutesPage from './pages/admin/AdminTripsRoutesPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
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
              element={<BookingPage />}
            />

            <Route
              path="/dat-ve-thanh-cong/:bookingCode"
              element={<BookingSuccessPage />}
            />

            <Route path="/thong-tin/:feature" element={<InfoPage />} />
            <Route path="/tin-tuc" element={<NewsListPage />} />
            <Route path="/tin-tuc/:id" element={<NewsDetailPage />} />

            <Route
              path="/dang-phat-trien/:feature"
              element={<ComingSoonPage />}
            />

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
                path="chuyen-xe-tuyen-duong"
                element={<AdminTripsRoutesPage />}
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
                path="ve-xe"
                element={<AdminBookingsPage />}
              />

              <Route
                path="ve-xe/:bookingCode"
                element={<AdminBookingDetailPage />}
              />

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

              <Route path="dia-diem" element={<AdminLocationsPage />} />

              <Route
                path="tin-tuc"
                element={<AdminNewsPage />}
              />

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