import { Screen } from '../components/Screen'
import { recovery } from '../logic/recovery'
import { pickPlace, productsFor, shopLink, mapLink } from '../data/care'

// Small line icons for the gear tiles, picked by what the item is.
const ICONS = {
  ice: 'M12 3v18M4.5 7.5l15 9M4.5 16.5l15-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2',
  shield: 'M12 3l7 3v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6z',
  crutch: 'M7 4h10M12 4v17M9 9h6M10 14h4',
  heat: 'M12 3c1 3.2 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 2 1 3 2 3 .4-3-1-6 1-9z',
  roller: 'M4 8h16v8H4zM8 8v8M12 8v8M16 8v8',
  grip: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8 8.5c2 1.2 2 5.8 0 7M16 8.5c-2 1.2-2 5.8 0 7',
  weights: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
}

function iconFor(name) {
  const n = name.toLowerCase()
  if (n.includes('ice')) return 'ice'
  if (n.includes('crutch')) return 'crutch'
  if (n.includes('heat')) return 'heat'
  if (n.includes('roller')) return 'roller'
  if (n.includes('grip')) return 'grip'
  if (/brace|sleeve|sling|tape/.test(n)) return 'shield'
  return 'weights'
}

function Icon({ d, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ARROW = 'M5 12h14M13 6l6 6-6 6'
const PIN = 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'

// Where to go and what to get, chosen for this injury. Used as the Care tab and as its own screen.
export function CareView({ partId, outcome, lastResult, stage, cantWalk, town }) {
  const place = pickPlace({ partId, outcome, lastResult })
  const products = productsFor({ partId, severity: outcome?.severity, stage, cantWalk })
  const relief = recovery.relief[partId]
  const tips = relief ? ((stage ?? 0) <= 1 ? relief.early : relief.later).slice(0, 3) : []

  return (
    <>
      <p className="section-label">Your next stop</p>
      <a className={`route ${place.tone}`} href={mapLink(place.search, town)} target="_blank" rel="noopener noreferrer">
        <span className="route-pin" aria-hidden="true">
          <i /><i />
          <Icon d={PIN} size={30} />
        </span>
        <span className="route-body">
          <span className={`urgency ${place.tone}`}>{place.when}</span>
          <span className="route-name">{place.name}</span>
          <span className="route-why">{place.why}</span>
        </span>
        <span className="route-go">
          Open in Maps
          <Icon d={ARROW} size={18} />
        </span>
      </a>

      {products.length > 0 && (
        <>
          <p className="section-label">Gear for this stage</p>
          <div className="gear">
            {products.map((p) => (
              <a key={p.name} className="gear-tile" href={shopLink(p.search)} target="_blank" rel="noopener noreferrer">
                <span className="gear-icon"><Icon d={ICONS[iconFor(p.name)]} /></span>
                <span className="gear-name">{p.name}</span>
                <span className="gear-why">{p.why}</span>
                <span className="gear-shop">Shop <Icon d={ARROW} size={14} /></span>
              </a>
            ))}
          </div>
        </>
      )}

      {tips.length > 0 && (
        <>
          <p className="section-label">Pain relief playbook</p>
          <ol className="playbook">
            {tips.map((t, i) => (
              <li key={t}>
                <span className="play-num">{i + 1}</span>
                <span className="play-text">{t}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

export function Care({ partId, outcome, lastResult, stage, cantWalk, town, onBack }) {
  return (
    <Screen onBack={onBack} title="Care">
      <CareView partId={partId} outcome={outcome} lastResult={lastResult} stage={stage} cantWalk={cantWalk} town={town} />
    </Screen>
  )
}
