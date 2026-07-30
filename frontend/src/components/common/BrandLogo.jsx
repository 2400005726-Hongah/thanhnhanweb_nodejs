import fullLogo from '../../assets/logo-thanh-nhan-full.jpg'
import headerLogo from '../../assets/logo-thanh-nhan-header.jpg'

const logoByVariant = {
  header: {
    src: headerLogo,
    width: 744,
    height: 300,
  },
  footer: {
    src: fullLogo,
    width: 1000,
    height: 563,
  },
  login: {
    src: fullLogo,
    width: 1000,
    height: 563,
  },
}

function BrandLogo({ variant = 'header', alt = 'Nhà xe Thành Nhân' }) {
  const logo = logoByVariant[variant] || logoByVariant.header

  return (
    <span className={`brand-logo brand-logo--${variant}`}>
      <img
        src={logo.src}
        alt={alt}
        width={logo.width}
        height={logo.height}
        loading={variant === 'header' ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  )
}

export default BrandLogo
