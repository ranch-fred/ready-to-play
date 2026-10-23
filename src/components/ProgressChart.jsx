import { useState } from 'react'

const W = 300
const H = 130
const L = 30 // room for the y labels
const R = 12
const T = 14
const B = 18

// Smooth curve through the points (Catmull-Rom turned into cubic Beziers).
function smooth(pts) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

// Everything the chart can show, built from the daily check-ins.
function metrics(plan, day) {
  // Strength-mode check-ins carry no plan estimate, so they don't belong on the recovery curves.
  const rec = plan.checkIns.filter((c) => typeof c.projected === 'number')
  const baseline = plan.baseline ?? 0
  const pain = plan.checkIns.filter((c) => typeof c.answers?.pain === 'number').map((c) => ({ day: c.day, v: c.answers.pain }))
  const recovery = [
    { day: 1, v: 0 },
    ...rec.map((c) => ({ day: c.day, v: baseline > 0 ? Math.round(Math.min(1, Math.max(0, 1 - c.score / baseline)) * 100) : 100 })),
  ]
  const togo = [
    { day: 1, v: Math.max(0, plan.padded - 1) },
    ...rec.map((c) => ({ day: c.day, v: Math.max(0, c.projected - c.day) })),
  ]
  return {
    pain: {
      tab: 'Pain',
      title: 'Pain',
      unit: '/10',
      note: 'Lower is better',
      series: pain,
      lo: 0,
      hi: 10,
      ticks: [0, 5, 10],
      target: { v: 2, label: 'Goal ≤ 2' },
      goodDown: true,
    },
    recovery: {
      tab: 'Recovery',
      title: 'Recovery',
      unit: '%',
      note: 'Higher is better',
      series: recovery,
      lo: 0,
      hi: 100,
      ticks: [0, 50, 100],
      target: { v: 100, label: 'Healed' },
      goodDown: false,
    },
    togo: {
      tab: 'Days left',
      title: 'Days to go',
      unit: 'd',
      note: 'Check-ins pull your date earlier',
      series: togo,
      lo: 0,
      hi: Math.max(5, Math.ceil((Math.max(...togo.map((p) => p.v)) * 1.12) / 2) * 2),
      get ticks() {
        return [0, this.hi / 2, this.hi]
      },
      target: null,
      goodDown: true,
    },
  }[day] ?? null
}

export function ProgressChart({ plan }) {
  const [tab, setTab] = useState('pain')
  const m = metrics(plan, tab)
  const { series } = m
  const empty = series.length < 2

  const xs = (d, first, last) => L + 6 + ((d - first) / Math.max(1, last - first)) * (W - L - R - 12)
  const ys = (v) => T + (1 - (v - m.lo) / (m.hi - m.lo)) * (H - T - B)
  const first = series[0]?.day ?? 1
  const last = series[series.length - 1]?.day ?? first + 1
  const pts = series.map((s) => ({ x: xs(s.day, first, last), y: ys(s.v), ...s }))
  const line = smooth(pts)
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - B} L${pts[0].x.toFixed(1)} ${H - B} Z` : ''
  const now = pts[pts.length - 1]
  const delta = pts.length > 1 ? now.v - pts[0].v : 0
  const better = m.goodDown ? delta < 0 : delta > 0
  const arrow = delta === 0 ? 'No change' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}${m.unit === '%' ? '%' : m.unit === 'd' ? ' d' : ''}`

  return (
    <div className="trend chart">
      <div className="chart-tabs" role="tablist" aria-label="What to chart">
        {['pain', 'recovery', 'togo'].map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {metrics(plan, k).tab}
          </button>
        ))}
      </div>

      <div className="trend-top">
        <p className="eyebrow">{m.title}</p>
        {!empty && <span className={`trend-delta ${delta === 0 ? '' : better ? 'down' : 'up'}`}>{arrow}</span>}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={empty ? `${m.title} chart, waiting for check-ins` : `${m.title} went from ${pts[0].v} to ${now.v}`}>
        <defs>
          <linearGradient id={`chart-fill-${tab}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {m.ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} className="trend-grid" />
            <text x={L - 6} y={ys(t) + 3.5} textAnchor="end" className="chart-tick">{t}</text>
          </g>
        ))}
        {m.target && m.target.v !== m.hi && (
          <g>
            <line x1={L} x2={W - R} y1={ys(m.target.v)} y2={ys(m.target.v)} className="chart-target" />
            <text x={W - R} y={ys(m.target.v) - 4} textAnchor="end" className="chart-target-label">{m.target.label}</text>
          </g>
        )}
        {empty ? (
          <path d={`M${L} ${H - B - 8} C 100 ${H - B - 30}, 170 ${T + 24}, ${W - R} ${T + 12}`} className="trend-ghost" />
        ) : (
          <>
            <path d={area} fill={`url(#chart-fill-${tab})`} className="trend-area" key={`a-${tab}`} />
            <path d={line} className="trend-line" pathLength="1" key={`l-${tab}`} />
            {pts.slice(0, -1).map((p, i) => <circle key={`${tab}-${i}`} cx={p.x} cy={p.y} r="3" className="trend-dot" />)}
            <circle cx={now.x} cy={now.y} r="5" className="trend-now" />
            <circle cx={now.x} cy={now.y} r="5" className="trend-ping" />
            <text x={Math.min(now.x, W - R - 8)} y={Math.max(now.y - 10, 10)} textAnchor="middle" className="chart-val">{now.v}{m.unit === '%' ? '%' : m.unit === '/10' ? '' : ''}</text>
          </>
        )}
      </svg>
      {empty ? (
        <p className="muted chart-empty">
          {tab === 'pain'
            ? 'Do two daily check-ins and your pain curve shows up here.'
            : 'Do a daily check-in and this curve starts moving.'}
        </p>
      ) : (
        <div className="trend-axis"><span>Day {first}</span><span>{m.note}</span><span>Day {last}</span></div>
      )}
    </div>
  )
}
