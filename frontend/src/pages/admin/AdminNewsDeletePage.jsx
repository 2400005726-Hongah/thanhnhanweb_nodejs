import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminDeleteConfirm from '../../components/admin/AdminDeleteConfirm.jsx'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { deleteNews, getNewsDetail } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getStatusLabel } from '../../utils/uiLabels.js'

function AdminNewsDeletePage() {
  const { id } = useParams(); const navigate = useNavigate(); const [item, setItem] = useState(null); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await getNewsDetail(id); const found = data.news; if (!found) throw new Error('Không tìm thấy tin tức.'); setItem(found) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [id])
  useEffect(() => { load() }, [load])
  const confirm = async () => { setProcessing(true); setError(''); try { await deleteNews(id); navigate('/admin/tin-tuc', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!item) return <ErrorState message={error || 'Không tìm thấy tin tức.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Xóa tin tức" description="Xóa mềm được xác nhận ở trang riêng." />{error && <div className="alert alert-danger">{error}</div>}<AdminDeleteConfirm title={`Xóa “${item.title}”`} warning="Bài viết sẽ bị xóa mềm; dữ liệu lịch sử vẫn được giữ theo nghiệp vụ hiện tại." rows={[{ label: 'Tiêu đề', value: item.title }, { label: 'Trạng thái', value: getStatusLabel(item.status) }, { label: 'Người tạo', value: item.createdBy?.fullName || '—' }, { label: 'Cập nhật', value: item.updatedAt ? formatDateTime(item.updatedAt) : '—' }]} backTo="/admin/tin-tuc" processing={processing} onConfirm={confirm} /></div>
}
export default AdminNewsDeletePage
