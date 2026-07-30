import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import BrandLogo from '../components/common/BrandLogo.jsx'
import { useAuth } from '../contexts/authContext.js'
import { getApiErrorMessage } from '../services/apiClient.js'

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (event) => {
    setError('')
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return

    if (form.password !== form.confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await signUp({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      navigate('/ve-cua-toi', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <BrandLogo variant="login" />
        <span className="eyebrow">TẠO TÀI KHOẢN KHÁCH HÀNG</span>
        <h1>Đăng ký</h1>
        <p>Tạo tài khoản để theo dõi và quản lý các chuyến đi.</p>

        <form onSubmit={submit}>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="auth-form-grid">
            <div className="auth-field--full">
              <label className="form-label" htmlFor="registerFullName">Họ và tên</label>
              <input
                autoComplete="name"
                className="form-control"
                id="registerFullName"
                maxLength="100"
                name="fullName"
                onChange={update}
                required
                value={form.fullName}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="registerEmail">Email</label>
              <input
                autoComplete="email"
                className="form-control"
                id="registerEmail"
                name="email"
                onChange={update}
                required
                type="email"
                value={form.email}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="registerPhone">Số điện thoại</label>
              <input
                autoComplete="tel"
                className="form-control"
                id="registerPhone"
                name="phone"
                onChange={update}
                required
                type="tel"
                value={form.phone}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="registerPassword">Mật khẩu</label>
              <input
                autoComplete="new-password"
                className="form-control"
                id="registerPassword"
                minLength="8"
                name="password"
                onChange={update}
                required
                type="password"
                value={form.password}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="registerConfirmPassword">Xác nhận mật khẩu</label>
              <input
                autoComplete="new-password"
                className="form-control"
                id="registerConfirmPassword"
                minLength="8"
                name="confirmPassword"
                onChange={update}
                required
                type="password"
                value={form.confirmPassword}
              />
            </div>
          </div>
          <p className="auth-password-note">
            Mật khẩu cần ít nhất 8 ký tự, gồm chữ cái và chữ số.
          </p>
          <button
            className="btn btn-primary w-100"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-switch">
          Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
        </p>
        <Link className="back-home" to="/">← Trở về trang chủ</Link>
      </div>
    </div>
  )
}

export default RegisterPage
