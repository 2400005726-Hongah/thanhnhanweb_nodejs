function AdminPageHeader({ eyebrow = 'NHÀ XE THÀNH NHÂN', title, description, actions }) {
  return (
    <div className="admin-page-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-heading-actions">{actions}</div>}
    </div>
  )
}

export default AdminPageHeader
