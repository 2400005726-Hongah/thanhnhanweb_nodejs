import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { createNews, getNewsDetail, updateNews } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'

const EMPTY = { title: '', summary: '', content: '', thumbnailUrl: '', status: 'DRAFT' }
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']); const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const readImageAsDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.')); reader.readAsDataURL(file) })

function AdminNewsFormPage({ mode = 'create' }) {
  const { id } = useParams(); const navigate = useNavigate(); const editing = mode === 'edit'; const [form, setForm] = useState({ ...EMPTY }); const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [found, setFound] = useState(!editing)
  const load = useCallback(async () => { if (!editing) return; setLoading(true); setError(''); try { const data = await getNewsDetail(id); const news = data.news; if (!news) throw new Error('Không tìm thấy tin tức.'); setFound(true); setForm({ title: news.title || '', summary: news.summary || '', content: news.content || '', thumbnailUrl: news.thumbnailUrl || '', status: news.status || 'DRAFT' }) } catch (e) { setFound(false); setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [editing, id])
  useEffect(() => { load() }, [load])
  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const chooseThumbnail = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (!ALLOWED_IMAGE_TYPES.has(file.type)) return setError('Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WEBP.'); if (file.size > MAX_IMAGE_SIZE) return setError('Ảnh không được vượt quá 5 MB.'); try { const thumbnailUrl = await readImageAsDataUrl(file); setForm((current) => ({ ...current, thumbnailUrl })); setError('') } catch (e) { setError(e.message) } }
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const payload = { ...form, thumbnailUrl: form.thumbnailUrl || null }; if (editing) await updateNews(id, payload); else await createNews(payload); navigate('/admin/tin-tuc', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)) } finally { setSaving(false) } }
  if (loading) return <LoadingState />
  if (editing && !found) return <ErrorState message={error || 'Không tìm thấy tin tức.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title={editing ? 'Sửa tin tức' : 'Thêm tin tức'} description="Biên tập nội dung ở trang riêng, danh sách không còn chứa form." /><section className="admin-panel admin-news-editor">{error && <div className="alert alert-danger">{error}</div>}<form className="admin-form-grid" onSubmit={submit}>
    <label className="admin-field admin-field--wide"><span>Tiêu đề</span><input className="form-control" name="title" onChange={updateField} required value={form.title} /></label>
    <label className="admin-field admin-field--wide"><span>Tóm tắt</span><textarea className="form-control" name="summary" onChange={updateField} rows="2" value={form.summary} /></label>
    <label className="admin-field admin-field--wide"><span>Nội dung</span><textarea className="form-control" name="content" onChange={updateField} required rows="9" value={form.content} /></label>
    <div className="admin-field admin-field--wide"><span>Ảnh đại diện</span><div className="admin-news-image-picker"><label className="btn btn-outline-secondary btn-sm mb-0">Chọn ảnh từ máy<input accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={chooseThumbnail} type="file" /></label><span className="text-muted small">JPG, PNG, WEBP; tối đa 5 MB.</span>{form.thumbnailUrl && <button className="btn btn-link btn-sm text-danger" onClick={() => setForm((c) => ({ ...c, thumbnailUrl: '' }))} type="button">Bỏ ảnh</button>}</div><input className="form-control mt-2" name="thumbnailUrl" onChange={updateField} placeholder="Hoặc dán URL ảnh https://..." value={form.thumbnailUrl.startsWith('data:image/') ? '' : form.thumbnailUrl} />{form.thumbnailUrl && <img alt="Xem trước ảnh đại diện" className="admin-news-image-preview mt-2" src={form.thumbnailUrl} />}</div>
    <label className="admin-field"><span>Trạng thái</span><select className="form-select" name="status" onChange={updateField} value={form.status}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã đăng</option><option value="INACTIVE">Ẩn</option></select></label>
    <div className="admin-field admin-field--wide admin-crud-actions"><Link className="btn btn-outline-secondary" to="/admin/tin-tuc">Hủy</Link><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm tin tức'}</button></div>
  </form></section></div>
}
export default AdminNewsFormPage
