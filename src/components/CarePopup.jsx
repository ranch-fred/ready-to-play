import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../logic/feedback'

// Shown over the home screen when the answers point to a doctor. Close it with the X (or tap outside) to keep going.
export function CarePopup({ care, onClose }) {
  const urgent = care.action === 'see_care_today'

  useEffect(() => {
    haptic([60, 40, 60])
    const onKey = (e) => e.key === 'Escape' && onClose(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className="care-overlay" onClick={() => onClose(false)}>
      <div
        className={`care-popup ${urgent ? 'alert' : 'caution'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="care-x" onClick={() => onClose(false)} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="care-badge">{urgent ? 'Care needed' : 'Get it checked'}</span>
        <h2 id="care-popup-title" className="care-title">See: {care.who}</h2>
        <p className="care-when">{care.when}</p>
        {care.notes.length > 0 && (
          <ul className="care-reasons">
            {care.notes.slice(0, 4).map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
        <button className="btn primary" onClick={() => onClose(true)}>Find care near me</button>
        <p className="care-foot">Your recovery plan is ready. Tap the X to see it.</p>
      </div>
    </div>,
    document.body,
  )
}
