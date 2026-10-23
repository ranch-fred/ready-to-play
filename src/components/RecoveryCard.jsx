import { lazy, Suspense, useState } from 'react'
import { healProgress, painSeries } from '../logic/recovery'
import { isRecovered } from '../logic/journey'

const HealingModel3D = lazy(() => import('./HealingModel3D'))

const W = 300
const H = 100
const PAD = 16

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

function Trend({ series }) {
  const grid = [0, 5, 10].map((v) => PAD + (1 - v / 10) * (H - PAD * 2))
  if (series.length < 2) {
    return (
      <div className="trend empty">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {grid.map((y) => <line key={y} x1={PAD} x2={W - PAD} y1={y} y2={y} className="trend-grid" />)}
          <path d={`M${PAD} ${H - PAD - 8} C 90 ${H - PAD - 30}, 150 ${PAD + 14}, ${W - PAD} ${PAD + 6}`} className="trend-ghost" />
        </svg>
        <p className="muted">
          {series.length === 1 ? 'One check-in logged. Do another tomorrow to see your pain trend.' : 'Do a daily check-in and your pain trend shows up here.'}
        </p>
      </div>
    )
  }
  const first = series[0]
  const last = series[series.length - 1]
  const span = Math.max(1, last.day - first.day)
  const pts = series.map((s) => ({
    x: PAD + ((s.day - first.day) / span) * (W - PAD * 2),
    y: PAD + (1 - s.pain / 10) * (H - PAD * 2),
  }))
  const line = smooth(pts)
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L${pts[0].x.toFixed(1)} ${H - PAD} Z`
  const delta = last.pain - first.pain
  const tail = pts[pts.length - 1]

  return (
    <div className="trend">
      <div className="trend-top">
        <p className="eyebrow">Pain trend</p>
        <span className={`trend-delta ${delta < 0 ? 'down' : delta > 0 ? 'up' : ''}`}>
          {delta === 0 ? 'No change' : `${delta < 0 ? '▼' : '▲'} ${Math.abs(delta)} since day ${first.day}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pain went from ${first.pain} to ${last.pain} out of 10`}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2ee67a" stopOpacity="0.38" />
            <stop offset="1" stopColor="#2ee67a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((y) => <line key={y} x1={PAD} x2={W - PAD} y1={y} y2={y} className="trend-grid" />)}
        <path d={area} fill="url(#trend-fill)" className="trend-area" />
        <path d={line} className="trend-line" pathLength="1" />
        {pts.slice(0, -1).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" className="trend-dot" />)}
        <circle cx={tail.x} cy={tail.y} r="5" className="trend-now" />
        <circle cx={tail.x} cy={tail.y} r="5" className="trend-ping" />
      </svg>
      <div className="trend-axis"><span>Day {first.day}</span><span>Pain 0–10</span><span>Day {last.day}</span></div>
    </div>
  )
}

export function RecoveryCard({ injury, plan, day }) {
  const [noModel, setNoModel] = useState(false)
  const heal = isRecovered(plan, day) ? 1 : healProgress(plan, day)
  const pct = Math.round(heal * 100)
  const series = painSeries(plan)
  const lastPain = series.length ? series[series.length - 1].pain : null
  const saved = Math.max(0, plan.padded - plan.projected)
  const spotIds = injury.locationIds ?? []
  const label = pct < 25 ? 'Fresh injury' : pct < 60 ? 'Rebuilding' : pct < 90 ? 'Almost there' : 'Back in action'

  return (
    <section className="card recovery" aria-label="Recovery">
      <header className="rc-head">
        <div>
          <p className="eyebrow">Recovery</p>
          <p className="rc-label">{label}</p>
        </div>
        <span className="rc-pct">{pct}<small>%</small></span>
      </header>

      {!noModel && (
        <div className="heal-wrap">
          <Suspense fallback={<div className="heal-stage" />}>
            <HealingModel3D region={injury.partId} side={injury.side ?? 'right'} spotIds={spotIds} heal={heal} onError={() => setNoModel(true)} />
          </Suspense>
          <div className="heal-scale" style={{ '--p': heal }} aria-hidden="true">
            <span className="heal-marker" />
            <div className="heal-legend"><span>Fresh</span><span>Healing</span><span>Healed</span></div>
          </div>
        </div>
      )}

      <div className="stat-strip">
        <div><b>{lastPain ?? '–'}</b><span>Pain now</span></div>
        <div><b className="volt">{saved}</b><span>{saved === 1 ? 'Day saved' : 'Days saved'}</span></div>
        <div><b>{plan.checkIns.length}</b><span>{plan.checkIns.length === 1 ? 'Check-in' : 'Check-ins'}</span></div>
      </div>

      <Trend series={series} />
    </section>
  )
}
