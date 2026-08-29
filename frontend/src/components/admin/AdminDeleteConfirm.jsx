import { Link } from 'react-router-dom'

function AdminDeleteConfirm({
  title,
  description,
  warning,
  rows = [],
  backTo,
  backLabel = 'Quay lại',
  confirmLabel = 'Xác nhận xóa',
  processing = false,
  disabled = false,
  onConfirm,
  children,
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <span>XÁC NHẬN THAO TÁC</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>

      {warning && <div className="alert alert-warning">{warning}</div>}

      {rows.length > 0 && (
        <div className="admin-crud-summary">
          {rows.map((row) => (
            <div className="admin-crud-summary__row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value || '—'}</strong>
            </div>
          ))}
        </div>
      )}

      {children}

      <div className="d-flex flex-wrap gap-2 mt-3">
        <Link className="btn btn-outline-secondary" to={backTo}>{backLabel}</Link>
        <button
          className="btn btn-danger"
          disabled={processing || disabled}
          onClick={onConfirm}
          type="button"
        >
          {processing ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </section>
  )
}

export default AdminDeleteConfirm
