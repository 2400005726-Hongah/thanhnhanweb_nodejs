import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminDeleteConfirm from '../../components/admin/AdminDeleteConfirm.jsx'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { deleteUser, getUsers } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatPhoneInput } from '../../utils/normalizers.js'

function AdminUserDeletePage() {
  const { id } = useParams(); const navigate = useNavigate(); const { user: currentUser } = useAuth(); const [item, setItem] = useState(null); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await getUsers({ page: 1, limit: 100 }); const found = (data.users ?? []).find((row) => row.id === id); if (!found) throw new Error('Không tìm thấy tài khoản.'); setItem(found) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [id])
  useEffect(() => { load() }, [load])
  const confirm = async () => { if (id === currentUser?.id) return setError('Không thể tự xóa tài khoản đang đăng nhập.'); setProcessing(true); setError(''); try { const result = await deleteUser(id); window.alert(result.deleted ? 'Đã xóa tài khoản.' : 'Đã lưu trữ tài khoản để bảo toàn lịch sử.'); navigate('/admin/tai-khoan', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!item) return <ErrorState message={error || 'Không tìm thấy tài khoản.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Xóa tài khoản" description="Xác nhận ở trang riêng trước khi xóa/lưu trữ tài khoản." />{error && <div className="alert alert-danger">{error}</div>}<AdminDeleteConfirm title={`Xóa tài khoản ${item.fullName}`} warning="Nếu tài khoản đã có lịch sử vận hành, hệ thống có thể lưu trữ thay vì xóa vật lý." rows={[{ label: 'Họ tên', value: item.fullName }, { label: 'Email', value: item.email }, { label: 'Số điện thoại', value: formatPhoneInput(item.phone) }, { label: 'Vai trò', value: item.role === 'ADMIN' ? 'Chủ xe' : 'Nhân viên quản trị' }]} backTo="/admin/tai-khoan" disabled={id === currentUser?.id} processing={processing} onConfirm={confirm} /></div>
}
export default AdminUserDeletePage
