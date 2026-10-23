import { lazy, Suspense, useState } from 'react'
import { healProgress, painSeries } from '../logic/recovery'
import { isRecovered } from '../logic/journey'

const HealingModel3D = lazy(() => import('./HealingModel3D'))

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
    </section>
  )
}
