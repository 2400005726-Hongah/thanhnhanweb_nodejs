import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  getAuditLogs,
} from '../../services/admin.service.js'
import {
  getApiErrorMessage,
} from '../../services/apiClient.js'
import {
  getAuditActionLabel,
  getAuditEntityLabel,
  getRoleLabel,
  translateAuditDescription,
} from '../../utils/auditLabels.js'
import {
  formatDateTime,
} from '../../utils/formatDateTime.js'

function AdminAuditLogsPage() {
  const [data, setData] =
    useState(null)

  const [error, setError] =
    useState('')

  const load = useCallback(
    async () => {
      setError('')

      try {
        const result =
          await getAuditLogs({
            page: 1,
            limit: 100,
          })

        setData(result)
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
          ),
        )
      }
    },
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <AdminPageHeader
        title="Nhật ký hệ thống"
        description="Chỉ Chủ xe được xem các thao tác quản trị."
      />

      {error ? (
        <ErrorState
          message={error}
          onRetry={load}
        />
      ) : !data ? (
        <LoadingState />
      ) : data.logs.length === 0 ? (
        <EmptyState message="Chưa có nhật ký thao tác." />
      ) : (
        <section className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>
                    Người thực hiện
                  </th>
                  <th>Quyền</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Mô tả</th>
                </tr>
              </thead>

              <tbody>
                {data.logs.map(
                  (log) => (
                    <tr key={log.id}>
                      <td>
                        {formatDateTime(
                          log.createdAt,
                        )}
                      </td>

                      <td>
                        <strong>
                          {log.user
                            ?.fullName ||
                            log.actorName ||
                            'Hệ thống'}
                        </strong>

                        <small>
                          {log.user
                            ?.email ||
                            'Không có email'}
                        </small>
                      </td>

                      <td>
                        <span className="status-badge">
                          {getRoleLabel(
                            log.role,
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {getAuditActionLabel(
                            log.action,
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {getAuditEntityLabel(
                            log.entityType,
                          )}
                        </strong>

                        <small>
                          Mã:{' '}
                          {log.entityId
                            ? String(
                                log.entityId,
                              )
                                .slice(
                                  0,
                                  8,
                                )
                                .toUpperCase()
                            : '—'}
                        </small>
                      </td>

                      <td>
                        {translateAuditDescription(
                          log.description,
                        )}

                        {log.reason && (
                          <small>
                            Lý do:{' '}
                            {log.reason}
                          </small>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default AdminAuditLogsPage