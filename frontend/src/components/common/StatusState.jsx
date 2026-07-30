function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="status-state" role="status" aria-live="polite">
      <span className="spinner-border text-primary" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="status-state status-state--error" role="alert">
      <span className="status-symbol">!</span>
      <h3>Chưa thể tải dữ liệu</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-primary" onClick={onRetry}>Thử lại</button>}
    </div>
  )
}

function EmptyState({ title = 'Chưa có dữ liệu', message }) {
  return (
    <div className="status-state">
      <span className="status-symbol status-symbol--muted">0</span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}

export { EmptyState, ErrorState, LoadingState }
