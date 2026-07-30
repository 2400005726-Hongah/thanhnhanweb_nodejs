import { BrowserRouter, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import CustomerLayout from './layouts/CustomerLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import BookingPage from './pages/BookingPage.jsx'
import BookingSuccessPage from './pages/BookingSuccessPage.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MyBookingsPage from './pages/MyBookingsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import SearchTripsPage from './pages/SearchTripsPage.jsx'
import TicketLookupPage from './pages/TicketLookupPage.jsx'
import TripDetailPage from './pages/TripDetailPage.jsx'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage.jsx'
import AdminBookingsPage from './pages/admin/AdminBookingsPage.jsx'
import AdminBusesPage from './pages/admin/AdminBusesPage.jsx'
import AdminCustomersPage from './pages/admin/AdminCustomersPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminNewsPage from './pages/admin/AdminNewsPage.jsx'
import AdminRevenuePage from './pages/admin/AdminRevenuePage.jsx'
import AdminTripsRoutesPage from './pages/admin/AdminTripsRoutesPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import { PERMISSIONS } from './utils/adminPermissions.js'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tim-chuyen" element={<SearchTripsPage />} />
            <Route path="/tra-cuu-ve" element={<TicketLookupPage />} />
            <Route path="/chuyen-xe/:tripId" element={<TripDetailPage />} />
            <Route path="/dat-ve/:tripId" element={<BookingPage />} />
            <Route
              path="/dat-ve-thanh-cong/:bookingCode"
              element={<BookingSuccessPage />}
            />
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route path="/dang-ky" element={<RegisterPage />} />
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/ve-cua-toi" element={<MyBookingsPage />} />
            </Route>
            <Route path="/dang-phat-trien/:feature" element={<ComingSoonPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="xe" element={<AdminBusesPage />} />
              <Route
                path="chuyen-xe-tuyen-duong"
                element={<AdminTripsRoutesPage />}
              />
              <Route path="ve-xe" element={<AdminBookingsPage />} />
              <Route path="khach-hang" element={<AdminCustomersPage />} />
              <Route path="tin-tuc" element={<AdminNewsPage />} />
              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.VIEW_REVENUE]}
                  />
                }
              >
                <Route path="thong-ke" element={<AdminRevenuePage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.MANAGE_USERS]}
                  />
                }
              >
                <Route path="tai-khoan" element={<AdminUsersPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute
                    requiredPermissions={[PERMISSIONS.VIEW_SYSTEM_LOGS]}
                  />
                }
              >
                <Route path="nhat-ky" element={<AdminAuditLogsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
