import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import formatCurrency from '../../utils/formatCurrency.js'

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(15, 23, 42, .42)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(430px, 100%)',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    background: '#fff',
    boxShadow: '0 24px 60px rgba(15, 23, 42, .22)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '16px 18px',
    borderBottom: '1px solid #eef0f3',
  },
  titleWrap: {
    minWidth: 0,
  },
  eyebrow: {
    display: 'block',
    marginBottom: '3px',
    color: '#c50416',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '.04em',
  },
  title: {
    margin: 0,
    color: '#20242b',
    fontSize: '20px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  close: {
    width: '32px',
    height: '32px',
    flex: '0 0 32px',
    border: '1px solid #e1e5ea',
    borderRadius: '8px',
    background: '#fff',
    color: '#4b5563',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  body: {
    padding: '18px',
  },
  description: {
    margin: '0 0 14px',
    color: '#667085',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  choices: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  choice: {
    minHeight: '128px',
    padding: '15px 12px',
    border: '1px solid #e2e6eb',
    borderRadius: '10px',
    background: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color .15s ease, background .15s ease, transform .15s ease',
  },
  choiceTitle: {
    display: 'block',
    marginBottom: '5px',
    color: '#20242b',
    fontSize: '15px',
    fontWeight: 800,
  },
  choiceDesc: {
    display: 'block',
    minHeight: '34px',
    color: '#7a8492',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  price: {
    display: 'block',
    marginTop: '12px',
    color: '#c50416',
    fontSize: '16px',
    fontWeight: 900,
  },
  footer: {
    padding: '0 18px 18px',
  },
  cancel: {
    width: '100%',
    minHeight: '38px',
    border: '1px solid #d8dde4',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#475467',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
}

function RoomTypeDialog({
  seat,
  singleRoomPrice,
  doubleRoomPrice,
  onChoose,
  onClose,
}) {
  useEffect(() => {
    if (!seat) return undefined

    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [seat, onClose])

  if (!seat || typeof document === 'undefined') return null

  const choose = (type) => {
    onChoose?.(type)
  }

  return createPortal(
    <div
      aria-label="Chọn loại phòng"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      role="dialog"
      style={styles.overlay}
    >
      <div style={styles.dialog}>
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <span style={styles.eyebrow}>CHỌN LOẠI PHÒNG</span>
            <h2 style={styles.title}>Mã phòng: {seat.seatCode}</h2>
          </div>

          <button
            aria-label="Đóng"
            onClick={onClose}
            style={styles.close}
            type="button"
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <p style={styles.description}>
            Chọn loại phòng phù hợp cho vị trí <strong>{seat.seatCode}</strong>.
          </p>

          <div style={styles.choices}>
            <button
              onClick={() => choose('SINGLE_ROOM')}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = '#c50416'
                event.currentTarget.style.background = '#fff7f8'
                event.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = '#e2e6eb'
                event.currentTarget.style.background = '#fff'
                event.currentTarget.style.transform = 'none'
              }}
              style={styles.choice}
              type="button"
            >
              <strong style={styles.choiceTitle}>Phòng đơn</strong>
              <span style={styles.choiceDesc}>Tối đa 1 khách</span>
              <strong style={styles.price}>
                {formatCurrency(Number(singleRoomPrice || 0))}
              </strong>
            </button>

            <button
              onClick={() => choose('DOUBLE_ROOM')}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = '#c50416'
                event.currentTarget.style.background = '#fff7f8'
                event.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = '#e2e6eb'
                event.currentTarget.style.background = '#fff'
                event.currentTarget.style.transform = 'none'
              }}
              style={styles.choice}
              type="button"
            >
              <strong style={styles.choiceTitle}>Phòng đôi</strong>
              <span style={styles.choiceDesc}>Tối đa 2 khách</span>
              <strong style={styles.price}>
                {formatCurrency(Number(doubleRoomPrice || 0))}
              </strong>
            </button>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancel} type="button">
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default RoomTypeDialog
