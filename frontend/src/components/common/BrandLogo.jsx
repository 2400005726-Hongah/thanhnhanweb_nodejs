import brandLogo from '../../assets/logo-thanh-nhan-moi.png'
import './BrandLogo.css'

const sizeByVariant = {
  header: {
    width: 1536,
    height: 1536,
  },
  footer: {
    width: 1536,
    height: 1536,
  },
  login: {
    width: 1536,
    height: 1536,
  },
}

function BrandLogo({ variant = 'header', alt = 'Nhà xe Thành Nhân' }) {
  const size = sizeByVariant[variant] || sizeByVariant.header

  return (
    <span className={`brand-logo brand-logo--${variant}`}>
      <img
        src={brandLogo}
        alt={alt}
        width={size.width}
        height={size.height}
        loading={variant === 'header' ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  )
}

export default BrandLogo
