import { useState } from 'react'
import { createPortal } from 'react-dom'
import { OstrichSvg } from './Mascot'
import { BUDDIES } from '../logic/journey'
import { getPrefs, setPrefs } from '../logic/feedback'
import { clearState } from '../logic/storage'

function Switch({ on, onChange, label, hint }) {
  return (
    <button className="switch-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="switch-text">
        <b>{label}</b>
        <span>{hint}</span>
      </span>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  )
}

// Name, town, look, buddy, sounds. Everything saves as you go; closing also saves any typing.
export function Settings({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [town, setTown] = useState(profile?.town ?? '')
  const [prefs, setLocalPrefs] = useState(getPrefs())
  const buddy = profile?.buddy ?? 'classic'
  const base = profile ?? {}

  const commit = () => onSave({ ...base, name: name.trim(), town: town.trim(), buddy })
  const close = () => {
    commit()
    onClose()
  }
  const pref = (patch) => setLocalPrefs(setPrefs(patch))
  const reset = () => {
    if (!window.confirm('Erase your injury, plan and settings from this phone and start over?')) return
    clearState()
    try {
      localStorage.removeItem('readytoplay:prefs')
    } catch {
      // ignore
    }
    window.location.reload()
  }

  return createPortal(
    <div className="settings-overlay" onClick={close}>
      <div className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button className="care-x" onClick={close} aria-label="Close settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <p className="section-label">About you</p>
        <div className="card settings-card">
          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} placeholder="What should we call you?" autoComplete="given-name" maxLength={24} />
          </label>
          <label className="field">
            <span>Town or ZIP <em>(to find doctors near you)</em></span>
            <input value={town} onChange={(e) => setTown(e.target.value)} onBlur={commit} placeholder="e.g. Edison, NJ" autoComplete="address-level2" maxLength={40} />
          </label>
        </div>

        <p className="section-label">Your buddy</p>
        <div className="buddy-grid" role="radiogroup" aria-label="Choose your buddy">
          {BUDDIES.map((b) => (
            <button
              key={b.id}
              role="radio"
              aria-checked={buddy === b.id}
              className={`buddy-card ${buddy === b.id ? 'on' : ''}`}
              onClick={() => onSave({ ...base, name: name.trim(), town: town.trim(), buddy: b.id })}
            >
              <span className="buddy-face" aria-hidden="true">{b.preview.svg === 'ostrich' ? <OstrichSvg /> : b.preview.face}</span>
              <b>{b.name}</b>
              <span>{b.blurb}</span>
            </button>
          ))}
        </div>

        <p className="section-label">Sound and buzz</p>
        <div className="card settings-card switches">
          <Switch on={prefs.haptics} onChange={(v) => pref({ haptics: v })} label="Vibration" hint="Little buzzes when you tap and finish things" />
          <Switch on={prefs.sound} onChange={(v) => pref({ sound: v })} label="Sounds" hint="Countdown beeps and the finish chime" />
        </div>

        <button className="btn primary" onClick={close}>Done</button>
        <button className="link-btn danger-link" onClick={reset}>Erase everything and start over</button>
      </div>
    </div>,
    document.body,
  )
}
