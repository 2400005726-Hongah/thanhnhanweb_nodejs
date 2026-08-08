import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  createNews,
  deleteNews,
  getNews,
  updateNews,
  updateNewsStatus,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getStatusLabel } from '../../utils/uiLabels.js'

const initialForm = {
  title: '',
  summary: '',
  content: '',
  thumbnailUrl: '',
  status: 'DRAFT',
}

function AdminNewsPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getNews({ page: 1, limit: 50 })
      setItems(data.news)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateField = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))

  const reset = () => {
    setEditingId(null)
    setForm(initialForm)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        thumbnailUrl: form.thumbnailUrl || null,
      }
      if (editingId) {
        await updateNews(editingId, payload)
      } else {
        await createNews(payload)
      }
      reset()
      await load()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const edit = (news) => {
    setEditingId(news.id)
    setForm({
      title: news.title,
      summary: news.summary || '',
      content: news.content,
      thumbnailUrl: news.thumbnailUrl || '',
      status: news.status,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeStatus = async (news, status) => {
    try {
      await updateNewsStatus(news.id, status)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const remove = async (news) => {
    if (!window.confirm(`Xóa mềm tin “${news.title}”?`)) return
    try {
      await deleteNews(news.id)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý tin tức"
        description="Chủ xe và Nhân viên quản trị đều có quyền quản lý nội dung."
      />
      <section className="admin-panel admin-news-editor">
        <div className="admin-panel-heading">
          <div>
            <span>BIÊN TẬP</span>
            <h2>{editingId ? 'Sửa tin tức' : 'Thêm tin tức'}</h2>
          </div>
          {editingId && <button className="btn btn-light" onClick={reset} type="button">Hủy sửa</button>}
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field admin-field--wide">
            <span>Tiêu đề</span>
            <input className="form-control" name="title" onChange={updateField} required value={form.title} />
          </label>
          <label className="admin-field admin-field--wide">
            <span>Tóm tắt</span>
            <textarea className="form-control" name="summary" onChange={updateField} rows="2" value={form.summary} />
          </label>
          <label className="admin-field admin-field--wide">
            <span>Nội dung</span>
            <textarea className="form-control" name="content" onChange={updateField} required rows="7" value={form.content} />
          </label>
          <label className="admin-field">
            <span>Ảnh đại diện (URL)</span>
            <input className="form-control" name="thumbnailUrl" onChange={updateField} type="url" value={form.thumbnailUrl} />
          </label>
          <label className="admin-field">
            <span>Trạng thái</span>
            <select className="form-select" name="status" onChange={updateField} value={form.status}>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã đăng</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ẩn</option>
            </select>
          </label>
          <div className="admin-field admin-field--wide">
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm tin tức'}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>NỘI DUNG</span><h2>Danh sách tin tức</h2></div>
        </div>
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState message="Chưa có tin tức nào." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Tiêu đề</th><th>Trạng thái</th><th>Người tạo</th><th>Cập nhật</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {items.map((news) => (
                  <tr key={news.id}>
                    <td><strong>{news.title}</strong><small>/{news.slug}</small></td>
                    <td><span className={`status-badge status-badge--${news.status.toLowerCase()}`}>{getStatusLabel(news.status)}</span></td>
                    <td>{news.createdBy?.fullName}</td>
                    <td>{formatDateTime(news.updatedAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button onClick={() => edit(news)} type="button">Sửa</button>
                        <button onClick={() => changeStatus(news, news.status === 'PUBLISHED' ? 'INACTIVE' : 'PUBLISHED')} type="button">
                          {news.status === 'PUBLISHED' ? 'Ẩn' : 'Đăng'}
                        </button>
                        <button className="is-danger" onClick={() => remove(news)} type="button">Xóa mềm</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default AdminNewsPage
