function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}) {
  return (
    <div className="admin-page-heading">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {actions && (
        <div className="admin-heading-actions">
          {actions}
        </div>
      )}
    </div>
  )
}

export default AdminPageHeader
