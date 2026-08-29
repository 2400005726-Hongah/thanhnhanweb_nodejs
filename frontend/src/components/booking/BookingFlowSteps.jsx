import './BookingFlowSteps.css'

const STEPS = [
  { number: 1, label: 'Chọn chỗ' },
  { number: 2, label: 'Chọn điểm đón, trả' },
  { number: 3, label: 'Nhập thông tin' },
  { number: 4, label: 'Thanh toán' },
]

function BookingFlowSteps({ activeStep }) {
  return (
    <nav className="booking-flow-steps" aria-label="Các bước đặt vé">
      {STEPS.map((step) => {
        const completed = step.number < activeStep
        const active = step.number === activeStep
        return (
          <div
            className={`booking-flow-step${completed ? ' is-completed' : ''}${active ? ' is-active' : ''}`}
            key={step.number}
          >
            <span className="booking-flow-step__number">
              {completed ? '✓' : step.number}
            </span>
            <strong>{step.number}. {step.label}</strong>
          </div>
        )
      })}
    </nav>
  )
}

export default BookingFlowSteps
