import { useState } from 'react'
import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import BrandLogo from '../components/common/BrandLogo.jsx'
import { useAuth } from '../contexts/authContext.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { formatPhoneInput, normalizeEmail } from '../utils/normalizers.js'

const getSafeReturnUrl = (value) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : '/ve-cua-toi'

function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (event) => {
    const { name, value } = event.target
    const identifier =
      name === 'identifier' && !/[A-Za-z@]/.test(value)
        ? formatPhoneInput(value)
        : value

    setError('')
    setForm((current) => ({
      ...current,
      [name]: name === 'identifier' ? identifier : value,
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')
    try {
      const session = await signIn({
        identifier: form.identifier.trim(),
        password: form.password,
      })
      const requestedReturnUrl = searchParams.get('returnUrl')
      const roleHome = ['ADMIN', 'STAFF'].includes(session.user.role)
        ? '/admin'
        : '/ve-cua-toi'
      navigate(
        requestedReturnUrl
          ? getSafeReturnUrl(requestedReturnUrl)
          : roleHome,
        { replace: true },
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo variant="login" />
        <span className="eyebrow">KHÁCH HÀNG THÀNH NHÂN</span>
        <h1>Đăng nhập</h1>
        <p>Quản lý thông tin và các chuyến đi của bạn.</p>

        <form onSubmit={submit}>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <label className="form-label" htmlFor="identifier">
            Email hoặc số điện thoại
          </label>
          <input
            autoComplete="username"
            className="form-control mb-3"
            id="identifier"
            name="identifier"
            onChange={update}
            required
            placeholder="Email hoặc 0912 345 678"
            onBlur={(event) => {
              if (event.target.value.includes('@')) {
                setForm((current) => ({
                  ...current,
                  identifier: normalizeEmail(event.target.value),
                }))
              }
            }}
            value={form.identifier}
          />
          <label className="form-label" htmlFor="password">
            Mật khẩu
          </label>
          <input
            autoComplete="current-password"
            className="form-control mb-3"
            id="password"
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
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-switch">
          Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link>
        </p>
        <Link className="back-home" to="/">← Trở về trang chủ</Link>
      </div>
    </div>
  )
}

export default LoginPage
