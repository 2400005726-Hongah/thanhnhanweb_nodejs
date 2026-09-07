import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import heroBusImage from '../../assets/anhtrangchu.jpg'
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
  const [showPassword, setShowPassword] = useState(false)
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
    <main
      className="admin-login-page"
      style={{ '--admin-login-bg-image': `url(${heroBusImage})` }}
    >
      <div className="admin-login-page__overlay" />
      <section className="admin-login-shell">
        <div className="admin-login-visual">
          <img className="admin-login-visual__image" src={heroBusImage} alt="Xe khách Thành Nhân" />
          <div className="admin-login-visual__overlay" />

          <div className="admin-login-visual__mark" aria-hidden="true">TN</div>

          <div className="admin-login-visual__headline">
            <strong>HỆ THỐNG QUẢN LÝ NHÀ XE</strong>
            <h2>THÀNH NHÂN</h2>
            <p>An toàn - Chu đáo - Thân thiện</p>
          </div>

          <div className="admin-login-visual__caption">
            <span>KHU VỰC NỘI BỘ</span>
            <strong>Dành cho Chủ xe và Nhân viên</strong>
          </div>
        </div>

        <div className="admin-login-panel">
          <div className="admin-login-panel__inner">
            <div className="admin-login-heading">
              <span>KHU VỰC QUẢN TRỊ</span>
              <h1>Đăng nhập</h1>
              <p>Nhập tài khoản được cấp để truy cập hệ thống quản lý Nhà xe Thành Nhân.</p>
            </div>

            <form className="admin-login-form" onSubmit={submit}>
              {error && <div className="alert alert-danger admin-login-error" role="alert">{error}</div>}

              <label className="admin-login-field" htmlFor="adminIdentifier">
                <span>Email hoặc số điện thoại</span>
                <input
                  autoComplete="username"
                  autoFocus
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
              </label>

              <label className="admin-login-field" htmlFor="adminPassword">
                <span>Mật khẩu</span>
                <div className="admin-login-password">
                  <input
                    autoComplete="current-password"
                    id="adminPassword"
                    name="password"
                    onChange={update}
                    placeholder="Nhập mật khẩu"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                  />
                  <button
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </label>

              <button className="admin-login-submit" disabled={loading} type="submit">
                <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
                {!loading && <b aria-hidden="true">→</b>}
              </button>
            </form>

            <div className="admin-login-footer">
              <a href="/">← Về website</a>
              <span>Chỉ dành cho tài khoản nội bộ</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AdminLoginPage
