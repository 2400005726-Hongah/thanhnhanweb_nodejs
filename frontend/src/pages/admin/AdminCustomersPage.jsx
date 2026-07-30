import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  getCustomers,
  updateCustomer,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

function AdminCustomersPage() {
  const [data, setData] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async (searchKeyword = '') => {
    setError('')
    try {
      setData(
        await getCustomers({
          page: 1,
          limit: 100,
          ...(searchKeyword && { keyword: searchKeyword }),
        }),
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const edit = async (customer) => {
    const fullName = window.prompt('Họ tên khách hàng:', customer.fullName)
    if (!fullName?.trim()) return
    const phone = window.prompt('Số điện thoại:', customer.phone)
    if (!phone?.trim()) return
    try {
      await updateCustomer(customer.id, { fullName, phone })
      await load(keyword)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader title="Khách hàng" description="Thông tin liên hệ khách hàng đã đăng ký." />
      <form className="admin-filter-bar" onSubmit={(event) => { event.preventDefault(); load(keyword) }}>
        <input className="form-control" onChange={(event) => setKeyword(event.target.value)} placeholder="Tên, email hoặc số điện thoại" value={keyword} />
        <button className="btn btn-primary" type="submit">Tìm kiếm</button>
      </form>
      {error ? <ErrorState message={error} onRetry={() => load(keyword)} /> : !data ? <LoadingState /> : data.users.length === 0 ? <EmptyState message="Chưa có khách hàng." /> : (
        <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Họ tên</th><th>Email</th><th>Số điện thoại</th><th>Trạng thái</th><th>Ngày tham gia</th><th>Thao tác</th></tr></thead>
          <tbody>{data.users.map((customer) => (
            <tr key={customer.id}><td><strong>{customer.fullName}</strong></td><td>{customer.email}</td><td>{customer.phone}</td><td>{customer.status}</td><td>{formatDateTime(customer.createdAt)}</td><td><div className="admin-row-actions"><button onClick={() => edit(customer)} type="button">Sửa liên hệ</button></div></td></tr>
          ))}</tbody>
        </table></div></section>
      )}
    </>
  )
}

export default AdminCustomersPage
