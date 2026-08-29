import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminDeleteConfirm from '../../components/admin/AdminDeleteConfirm.jsx'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { archiveCustomer, getCustomerDetail } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatPhoneInput } from '../../utils/normalizers.js'

const STATUS_LABELS = { ACTIVE: 'Hoạt động', BLOCKED: 'Đã khóa', ARCHIVED: 'Lưu trữ' }

function AdminCustomerDeletePage() {
  const { id } = useParams(); const navigate = useNavigate(); const [customer, setCustomer] = useState(null); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getCustomerDetail(id); const data = result?.customer ?? result; if (!data?.id) throw new Error('Không tìm thấy khách hàng.'); setCustomer(data) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [id])
  useEffect(() => { load() }, [load])
  const confirm = async () => { setProcessing(true); setError(''); try { const result = await archiveCustomer(id); window.alert(result.deleted ? 'Đã xóa khách hàng chưa có lịch sử vé.' : 'Đã lưu trữ khách hàng và giữ nguyên lịch sử vé.'); navigate('/admin/khach-hang', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!customer) return <ErrorState message={error || 'Không tìm thấy khách hàng.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Xóa/Lưu trữ khách hàng" description="Xác nhận ở trang riêng để giữ an toàn dữ liệu lịch sử." />{error && <div className="alert alert-danger">{error}</div>}<AdminDeleteConfirm title={`Xóa/Lưu trữ ${customer.fullName}`} warning="Nếu khách hàng đã có lịch sử vé, hệ thống sẽ lưu trữ thay vì xóa dữ liệu liên quan." rows={[{ label: 'Khách hàng', value: customer.fullName }, { label: 'Số điện thoại', value: formatPhoneInput(customer.phone) }, { label: 'Email', value: customer.email || 'Chưa có' }, { label: 'Trạng thái', value: STATUS_LABELS[customer.status] || 'Không xác định' }]} backTo="/admin/khach-hang" confirmLabel="Xác nhận xóa/lưu trữ" processing={processing} onConfirm={confirm} /></div>
}
export default AdminCustomerDeletePage
