import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminDeleteConfirm from '../../components/admin/AdminDeleteConfirm.jsx'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { deleteTrip, getTrip } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'

const STATUS_LABELS = { OPEN: 'Đang mở bán', CLOSED: 'Ngừng bán', DEPARTED: 'Đã khởi hành', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy' }

function AdminTripDeletePage() {
  const { tripId } = useParams(); const navigate = useNavigate(); const [trip, setTrip] = useState(null); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getTrip(tripId); const data = result?.trip ?? result; if (!data?.id) throw new Error('Không tìm thấy chuyến xe.'); setTrip(data) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [tripId])
  useEffect(() => { load() }, [load])
  const confirm = async () => { setProcessing(true); setError(''); try { await deleteTrip(tripId); navigate('/admin/chuyen-xe', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!trip) return <ErrorState message={error || 'Không tìm thấy chuyến xe.'} onRetry={load} />
  const departure = trip.departureLocation || trip.route?.departureLocation
  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
  return <div className="admin-crud-page"><AdminPageHeader title="Hủy chuyến xe" description="Thao tác hủy chuyến được xác nhận ở trang riêng." />{error && <div className="alert alert-danger">{error}</div>}<AdminDeleteConfirm title={`Hủy chuyến ${String(trip.id).slice(0, 8).toUpperCase()}`} warning="Chuyến bị hủy sẽ không tiếp tục bán vé. Dữ liệu lịch sử vẫn được giữ." rows={[{ label: 'Hành trình', value: `${departure?.name || '—'} → ${arrival?.name || '—'}` }, { label: 'Xe', value: formatLicensePlate(trip.bus?.licensePlate || '') || '—' }, { label: 'Khởi hành', value: trip.departureTime ? formatDateTime(trip.departureTime) : '—' }, { label: 'Trạng thái', value: STATUS_LABELS[trip.status] || 'Không xác định' }]} backTo="/admin/chuyen-xe" confirmLabel="Xác nhận hủy chuyến" processing={processing} onConfirm={confirm} /></div>
}
export default AdminTripDeletePage
