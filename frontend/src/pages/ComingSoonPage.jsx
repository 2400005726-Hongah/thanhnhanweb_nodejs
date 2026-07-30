import { Link, useParams } from 'react-router-dom'

const titles = { 'tra-cuu-ve': 'Tra cứu vé', 'gioi-thieu': 'Giới thiệu nhà xe', 'lien-he': 'Liên hệ' }

function ComingSoonPage() {
  const { feature } = useParams()
  return <div className="simple-page"><div className="status-symbol">TN</div><span className="eyebrow">ĐANG PHÁT TRIỂN</span><h1>{titles[feature] || 'Tính năng mới'}</h1><Link className="btn btn-primary" to="/">Về trang chủ</Link></div>
}

export default ComingSoonPage
