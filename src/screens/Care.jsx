import { Screen } from '../components/Screen'
import { recovery } from '../logic/recovery'

function mapLink(search, town) {
  const where = town ? `near ${town}` : 'near me'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${search} ${where}`)}`
}

export function Care({ town, onBack }) {
  const { care } = recovery
  return (
    <Screen onBack={onBack} title="Find care near you" subtitle={town ? `Showing places near ${town}.` : 'Opens a map of places near you.'}>
      <div className="card danger">
        <p className="card-title">Call 911 or go to the ER if:</p>
        <ul className="list">
          {care.emergencySigns.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <a className="btn danger-btn" href="tel:911">Call 911</a>
      </div>

      <div className="card cleared">
        <p className="card-title">Your school's athletic trainer</p>
        <p className="muted">{care.trainer}</p>
      </div>

      {care.places.map((p) => (
        <a key={p.label} className="card place" href={mapLink(p.search, town)} target="_blank" rel="noopener noreferrer">
          <p className="card-title">{p.label}</p>
          <p className="muted">{p.when}</p>
          <p className="go">Show on map →</p>
        </a>
      ))}
    </Screen>
  )
}
