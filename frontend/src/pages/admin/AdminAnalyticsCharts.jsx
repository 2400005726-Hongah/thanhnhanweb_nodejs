import { useMemo, useState } from 'react'
import formatCurrency from '../../utils/formatCurrency.js'

const COLORS = ['#e52b35', '#f59e0b', '#16a05d', '#26313d', '#3b82f6', '#8b5cf6', '#0ea5e9']

const compactMoney = (value) => {
  const amount = Number(value || 0)
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount % 1_000_000_000 ? 1 : 0)} tỷ`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 ? 1 : 0)} triệu`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`
  return `${amount}`
}

const safeCount = (value) => Math.max(0, Number(value || 0))

function RevenueTicketsChart({ items = [], height = 320, showLegend = true }) {
  const [activeKey, setActiveKey] = useState(null)
  const width = 1000
  const padding = { top: 34, right: 32, bottom: 52, left: 72 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxRevenue = Math.max(...items.map((item) => safeCount(item.revenue)), 1)
  const step = items.length ? plotWidth / items.length : plotWidth
  const barWidth = Math.max(7, Math.min(28, step * 0.52))
  const revenueTicks = [0, .25, .5, .75, 1]
  const xLabelEvery = items.length <= 31 ? 1 : items.length <= 62 ? 2 : 4

  const chartBars = useMemo(() => items.map((item, index) => {
    const revenue = safeCount(item.revenue)
    const barHeight = (revenue / maxRevenue) * plotHeight
    const x = padding.left + step * index + (step - barWidth) / 2
    const y = padding.top + plotHeight - barHeight
    const label = item.date?.slice(8, 10) || item.label || `${index + 1}`
    const key = item.date || item.key || `${index}`
    return { item, index, revenue, barHeight, x, y, label, key }
  }), [items, maxRevenue, plotHeight, step, barWidth])

  const activeBar = chartBars.find((bar) => bar.key === activeKey) || null
  const tooltipWidth = 118
  const tooltipHeight = 46
  const tooltipGap = 8
  const tooltipX = activeBar
    ? Math.min(width - padding.right - tooltipWidth, Math.max(padding.left + 4, activeBar.x + barWidth / 2 - 14))
    : 0
  const tooltipY = activeBar
    ? Math.max(padding.top + 4, activeBar.y - tooltipHeight - tooltipGap)
    : 0

  if (!items.length) {
    return <div className="analytics-chart-empty">Không có dữ liệu trong khoảng đã chọn.</div>
  }

  return (
    <div className="analytics-chart-wrap">
      {showLegend && (
        <div className="analytics-chart-legend">
          <span><i className="is-revenue" />Doanh thu</span>
        </div>
      )}
      <svg
        className="analytics-revenue-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ doanh thu"
      >
        {revenueTicks.map((tick) => {
          const y = padding.top + plotHeight - plotHeight * tick
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="analytics-grid-line" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="analytics-axis-text">
                {compactMoney(maxRevenue * tick)}
              </text>
            </g>
          )
        })}

        {chartBars.map((bar) => {
          const { item, index, revenue, barHeight, x, y, label, key } = bar
          const isActive = activeBar?.key === key
          return (
            <g
              key={key}
              className={`analytics-bar-group${isActive ? ' is-active' : ''}`}
              onClick={() => setActiveKey(key)}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, revenue ? 2 : 0)}
                rx="3"
                className="analytics-revenue-bar"
              >
                <title>{`${item.date || label}: ${formatCurrency(revenue)}`}</title>
              </rect>
              {index % xLabelEvery === 0 && (
                <text x={padding.left + step * index + step / 2} y={height - 22} textAnchor="middle" className="analytics-axis-text analytics-axis-x">
                  {label}
                </text>
              )}
            </g>
          )
        })}

        {activeBar && (
          <g className="analytics-revenue-tooltip" pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="8" className="analytics-revenue-tooltip-box" />
            <text x={tooltipX + 12} y={tooltipY + 15} className="analytics-revenue-tooltip-date">{activeBar.label}</text>
            <rect x={tooltipX + 12} y={tooltipY + 24} width="8" height="8" rx="2" className="analytics-revenue-tooltip-dot" />
            <text x={tooltipX + 26} y={tooltipY + 31} className="analytics-revenue-tooltip-value">{formatCurrency(activeBar.revenue)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function DonutChart({ items = [], labelFormatter = (item) => item.label || item.key, centerLabel = 'Tổng' }) {
  const normalized = items
    .map((item, index) => ({ ...item, count: safeCount(item.count), color: COLORS[index % COLORS.length] }))
    .filter((item) => item.count > 0)
  const total = normalized.reduce((sum, item) => sum + item.count, 0)
  let offset = 0

  if (!total) return <div className="analytics-chart-empty analytics-chart-empty--small">Chưa có dữ liệu.</div>

  return (
    <div className="analytics-donut-layout">
      <div className="analytics-donut">
        <svg viewBox="0 0 120 120" aria-label="Biểu đồ tròn">
          <circle cx="60" cy="60" r="42" className="analytics-donut-track" />
          {normalized.map((item) => {
            const length = (item.count / total) * 100
            const segment = (
              <circle
                key={item.key || item.label}
                cx="60"
                cy="60"
                r="42"
                pathLength="100"
                stroke={item.color}
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={-offset}
                className="analytics-donut-segment"
              >
                <title>{`${labelFormatter(item)}: ${item.count}`}</title>
              </circle>
            )
            offset += length
            return segment
          })}
        </svg>
        <div className="analytics-donut-center"><strong>{total}</strong><span>{centerLabel}</span></div>
      </div>
      <div className="analytics-donut-legend">
        {normalized.map((item) => (
          <div key={item.key || item.label}>
            <i style={{ background: item.color }} />
            <span>{labelFormatter(item)}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizontalBarsChart({ items = [], labelFormatter = (item) => item.label || item.key }) {
  const normalized = items.map((item) => ({ ...item, count: safeCount(item.count) }))
  const max = Math.max(...normalized.map((item) => item.count), 1)

  if (!normalized.length) return <div className="analytics-chart-empty analytics-chart-empty--small">Chưa có dữ liệu.</div>

  return (
    <div className="analytics-horizontal-bars">
      {normalized.map((item) => (
        <div className="analytics-horizontal-row" key={item.key || item.label}>
          <span>{labelFormatter(item)}</span>
          <div><i style={{ width: `${(item.count / max) * 100}%` }} /></div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  )
}

export { DonutChart, HorizontalBarsChart, RevenueTicketsChart }
