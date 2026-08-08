import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import BrandLogo from '../../components/common/BrandLogo.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatPhoneInput, normalizeEmail } from '../../utils/normalizers.js'

const getSafeAdminReturnUrl = (value) =>
  value?.startsWith('/admin') && !value.startsWith('//')
    ? value
    : '/admin'

function AdminLoginPage() {
  const { isAuthenticated, signInAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Đăng nhập quản trị - Nhà xe Thành Nhân'
  }, [])

  if (isAuthenticated && ['ADMIN', 'STAFF'].includes(user?.role)) {
    return <Navigate replace to="/admin" />
  }

  const update = (event) => {
    const { name, value } = event.target
    const nextValue =
      name === 'identifier' && !/[A-Za-z@]/.test(value)
        ? formatPhoneInput(value)
        : value

    setError('')
    setForm((current) => ({ ...current, [name]: nextValue }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')
    try {
      await signInAdmin({
        identifier: form.identifier.trim(),
        password: form.password,
      })
      navigate(getSafeAdminReturnUrl(searchParams.get('returnUrl')), {
        replace: true,
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <BrandLogo variant="login" />
        <span className="eyebrow">KHU VỰC QUẢN TRỊ</span>
        <h1>Đăng nhập Nhà xe Thành Nhân</h1>
        <p>
          Chỉ dành cho Chủ xe và Nhân viên đã được Chủ xe cấp tài khoản.
        </p>

        <form onSubmit={submit}>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <label className="form-label" htmlFor="adminIdentifier">
            Email hoặc số điện thoại
          </label>
          <input
            autoComplete="username"
            autoFocus
            className="form-control mb-3"
            id="adminIdentifier"
            name="identifier"
            onBlur={(event) => {
              if (event.target.value.includes('@')) {
                setForm((current) => ({
                  ...current,
                  identifier: normalizeEmail(event.target.value),
                }))
              }
            }}
            onChange={update}
            placeholder="Email hoặc 0912 345 678"
            required
            value={form.identifier}
          />

          <label className="form-label" htmlFor="adminPassword">
            Mật khẩu
          </label>
          <input
            autoComplete="current-password"
            className="form-control mb-3"
            id="adminPassword"
            name="password"
            onChange={update}
            required
            type="password"
            value={form.password}
          />

          <button
            className="btn btn-primary w-100"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập quản trị'}
          </button>
        </form>

        <small className="admin-login-note">
          Tài khoản Nhân viên/Chủ xe được tạo và quản lý trong mục Tài khoản
          của Chủ xe; không có đăng ký công khai.
        </small>
      </div>
    </div>
  )
}

export default AdminLoginPage
