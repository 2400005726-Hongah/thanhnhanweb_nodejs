import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getNews, updateNewsStatus } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getStatusLabel } from '../../utils/uiLabels.js'

function AdminNewsPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [processingId, setProcessingId] = useState('')
  const load = async () => { setLoading(true); setError(''); try { const data = await getNews({ page: 1, limit: 50 }); setItems(data.news ?? []) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const changeStatus = async (news, status) => { setProcessingId(news.id); try { await updateNewsStatus(news.id, status); await load() } catch (e) { window.alert(getApiErrorMessage(e)) } finally { setProcessingId('') } }
  return <>
    <AdminPageHeader title="Quản lý tin tức" description="Danh sách nội dung. Thêm, sửa và xóa mở ở trang riêng." actions={<Link className="btn btn-primary" to="/admin/tin-tuc/them">+ Thêm tin tức</Link>} />
    {error ? (
      <ErrorState message={error} onRetry={load} />
    ) : loading ? (
      <LoadingState />
    ) : items.length === 0 ? (
      <EmptyState message="Chưa có tin tức nào." />
    ) : <section className="admin-panel"><div className="admin-panel-heading"><div><span>NỘI DUNG</span><h2>Danh sách tin tức</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tiêu đề</th><th>Trạng thái</th><th>Lượt xem</th><th>Người tạo</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>{items.map((news) => <tr key={news.id}><td><strong>{news.title}</strong><small>/{news.slug}</small></td><td><span className={`status-badge status-badge--${String(news.status || '').toLowerCase()}`}>{getStatusLabel(news.status)}</span></td><td><strong>{news.viewCount ?? 0}</strong></td><td>{news.createdBy?.fullName || '—'}</td><td>{formatDateTime(news.updatedAt)}</td><td><div className="admin-row-actions"><Link to={`/admin/tin-tuc/${news.id}/sua`}>Sửa</Link><button disabled={processingId === news.id} onClick={() => changeStatus(news, news.status === 'PUBLISHED' ? 'INACTIVE' : 'PUBLISHED')} type="button">{news.status === 'PUBLISHED' ? 'Ẩn' : 'Đăng'}</button><Link className="is-danger" to={`/admin/tin-tuc/${news.id}/xoa`}>Xóa mềm</Link></div></td></tr>)}</tbody></table></div></section>}
  </>
}
export default AdminNewsPage
