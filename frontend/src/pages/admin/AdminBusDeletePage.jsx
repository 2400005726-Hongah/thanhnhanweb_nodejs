import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminDeleteConfirm from '../../components/admin/AdminDeleteConfirm.jsx'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { deleteBus, getBuses } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getBusTypeLabel } from '../../utils/busTypes.js'
import { formatLicensePlate } from '../../utils/normalizers.js'

const STATUS_LABELS = { ACTIVE: 'Hoạt động', MAINTENANCE: 'Bảo trì', INACTIVE: 'Ngừng hoạt động' }

function AdminBusDeletePage() {
  const { id } = useParams(); const navigate = useNavigate()
  const [bus, setBus] = useState(null); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getBuses({ page: 1, limit: 100 }); const found = (result?.buses ?? []).find((item) => item.id === id); if (!found) throw new Error('Không tìm thấy xe.'); setBus(found) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [id])
  useEffect(() => { load() }, [load])
  const confirm = async () => { setProcessing(true); setError(''); try { await deleteBus(id); navigate('/admin/xe', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!bus) return <ErrorState message={error || 'Không tìm thấy xe.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Ngừng hoạt động xe" description="Thao tác được xác nhận ở trang riêng để tránh bấm nhầm." />{error && <div className="alert alert-danger">{error}</div>}<AdminDeleteConfirm title={`Ngừng hoạt động ${formatLicensePlate(bus.licensePlate)}`} description="Xe vẫn được giữ trong lịch sử nhưng không thể dùng cho chuyến mới." warning="Các chuyến/vé lịch sử không bị xóa." rows={[{ label: 'Biển số', value: formatLicensePlate(bus.licensePlate) }, { label: 'Loại xe', value: getBusTypeLabel(bus.busType) }, { label: 'Số ghế/phòng', value: String(bus.capacity ?? '—') }, { label: 'Trạng thái hiện tại', value: STATUS_LABELS[bus.status] || 'Không xác định' }]} backTo="/admin/xe" confirmLabel="Xác nhận ngừng hoạt động" processing={processing} onConfirm={confirm} /></div>
}
export default AdminBusDeletePage
