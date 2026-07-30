import { Link } from 'react-router-dom'

function NotFoundPage() {
  return <div className="simple-page"><div className="status-symbol">404</div><span className="eyebrow">KHÔNG TÌM THẤY TRANG</span><h1>Bạn đang đi nhầm tuyến</h1><p>Địa chỉ này không tồn tại hoặc đã được thay đổi.</p><Link className="btn btn-primary" to="/">Về trang chủ</Link></div>
}

export default NotFoundPage
