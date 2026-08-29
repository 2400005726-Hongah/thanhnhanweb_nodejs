import './StatusState.css'

function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="ui-state ui-state--loading" role="status" aria-live="polite">
      <span className="ui-state__spinner" aria-hidden="true" />
      <span className="ui-state__text">{label}</span>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <div className="ui-state__body">
        <strong>Không tải được dữ liệu</strong>
        {message && <p>{message}</p>}
      </div>
      {onRetry && (
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={onRetry}
          type="button"
        >
          Tải lại
        </button>
      )}
    </div>
  )
}

function EmptyState({ title = 'Chưa có dữ liệu', message }) {
  return (
    <div className="ui-state ui-state--empty">
      <div className="ui-state__body">
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
    </div>
  )
}

export { EmptyState, ErrorState, LoadingState }
