import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { deleteBooking, getBookingDetail } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatBookingCode, formatPhoneInput } from '../../utils/normalizers.js'

function AdminBookingDeletePage() {
  const { bookingCode } = useParams(); const navigate = useNavigate(); const [booking, setBooking] = useState(null); const [reason, setReason] = useState(''); const [loading, setLoading] = useState(true); const [processing, setProcessing] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getBookingDetail(bookingCode); const data = result?.booking ?? result; if (!data?.bookingCode) throw new Error('Không tìm thấy vé.'); setBooking(data) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [bookingCode])
  useEffect(() => { load() }, [load])
  const confirm = async (event) => { event.preventDefault(); const normalized = reason.trim(); if (normalized.length < 5 || normalized.length > 500) return setError('Lý do xóa vé phải có từ 5 đến 500 ký tự.'); setProcessing(true); setError(''); try { await deleteBooking(bookingCode, normalized); navigate('/admin/ve-xe', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)); setProcessing(false) } }
  if (loading) return <LoadingState />
  if (!booking) return <ErrorState message={error || 'Không tìm thấy vé.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Xóa vé" description={`Mã vé: ${formatBookingCode(booking.bookingCode)}`} /><section className="admin-panel">{error && <div className="alert alert-danger">{error}</div>}<div className="alert alert-warning"><strong>Xóa mềm vé và giải phóng ghế/phòng.</strong> Dữ liệu lịch sử vẫn được giữ theo nghiệp vụ hệ thống.</div><div className="admin-crud-summary"><div className="admin-crud-summary__row"><span>Hành khách</span><strong>{booking.passengerFullName}</strong></div><div className="admin-crud-summary__row"><span>Số điện thoại</span><strong>{formatPhoneInput(booking.passengerPhone)}</strong></div><div className="admin-crud-summary__row"><span>Ghế/Phòng</span><strong>{(booking.tickets || []).map((ticket) => ticket.seat?.seatCode || ticket.seatCode).filter(Boolean).join(', ') || '—'}</strong></div><div className="admin-crud-summary__row"><span>Tổng tiền</span><strong>{formatCurrency(booking.totalAmount ?? 0)}</strong></div></div><form className="mt-3" onSubmit={confirm}><label className="admin-field admin-field--wide"><span>Lý do xóa vé</span><textarea className="form-control" maxLength={500} minLength={5} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do từ 5 đến 500 ký tự..." required rows="4" value={reason} /><small>{reason.trim().length}/500 ký tự</small></label><div className="admin-crud-actions"><Link className="btn btn-outline-secondary" to={`/admin/ve-xe/${bookingCode}`}>Hủy</Link><button className="btn btn-danger" disabled={processing} type="submit">{processing ? 'Đang xóa...' : 'Xác nhận xóa vé'}</button></div></form></section></div>
}
export default AdminBookingDeletePage
