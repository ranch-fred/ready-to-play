import { Screen } from '../components/Screen'
import { recovery } from '../logic/recovery'
import { pickPlace, productsFor, shopLink, mapLink } from '../data/care'

// Where to go and what to get, chosen for this injury. Used as the Care tab and as its own screen.
export function CareView({ partId, outcome, lastResult, stage, cantWalk, town }) {
  const place = pickPlace({ partId, outcome, lastResult })
  const products = productsFor({ partId, severity: outcome?.severity, stage, cantWalk })
  const relief = recovery.relief[partId]
  const tips = relief ? ((stage ?? 0) <= 1 ? relief.early : relief.later).slice(0, 3) : []

  return (
    <>
      <p className="section-label">Where to go</p>
      <a className="card place-pick" href={mapLink(place.search, town)} target="_blank" rel="noopener noreferrer">
        <p className="card-title">{place.name}</p>
        <p className="muted">{place.why}</p>
        <span className="btn primary small">Open in Maps</span>
      </a>

      {products.length > 0 && (
        <>
          <p className="section-label">What to get</p>
          <div className="products">
            {products.map((p) => (
              <a key={p.name} className="product" href={shopLink(p.search)} target="_blank" rel="noopener noreferrer">
                <span className="product-text">
                  <span className="product-name">{p.name}</span>
                  <span className="muted">{p.why}</span>
                </span>
                <span className="shop">Shop →</span>
              </a>
            ))}
          </div>
        </>
      )}

      {tips.length > 0 && (
        <>
          <p className="section-label">Pain relief</p>
          <div className="card">
            <ul className="list">
              {tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
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
