import { rules } from '../logic/triage'

// A bare footprint (right foot; the left is mirrored). Walking steps alternate left and right.
export function Footprint({ left, className = '' }) {
  return (
    <svg className={`foot ${left ? 'left' : 'right'} ${className}`} viewBox="0 0 24 46" aria-hidden="true">
      <path d="M7 16C4.5 18.5 6 22 8.5 27c2 4 0 8 1 12 1 4 7.500 4.500 8-.5.500-4.500-1.500-7.500 0-12.500 1.500-5 2.500-9 -.500-11.500C14 12.500 9.500 13 7 16Z" />
      <circle cx="7.500" cy="8.500" r="3.200" />
      <circle cx="12.200" cy="6.600" r="1.900" />
      <circle cx="15.600" cy="7.600" r="1.800" />
      <circle cx="18.600" cy="9.600" r="1.600" />
      <circle cx="20.800" cy="12.600" r="1.350" />
    </svg>
  )
}

export function Screen({ step, totalSteps, onBack, title, subtitle, children, footer, stickyFooter }) {
  return (
    <div className="screen">
      <header className="topbar">
        {onBack ? (
          <button className="back" onClick={onBack} aria-label="Go back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : (
          <span className="back-spacer" />
        )}
        {step && (
          <div className="progress" aria-label={`Step ${step} of ${totalSteps}`}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <Footprint key={i} left={i % 2 === 0} className={i + 1 === step ? 'on fresh' : i < step ? 'on' : ''} />
            ))}
          </div>
        )}
        <span className="back-spacer" />
      </header>
      {title && <h1 className="title">{title}</h1>}
      {subtitle && <p className="subtitle">{subtitle}</p>}
      <div className="content">{children}</div>
      {footer && <div className={`footer ${stickyFooter ? 'sticky' : ''}`}>{footer}</div>}
      <p className="disclaimer">{rules.meta.disclaimer}</p>
    </div>
  )
}

export function Choice({ label, hint, onClick, selected }) {
  return (
    <button className={`choice ${selected ? 'on' : ''}`} onClick={onClick} aria-pressed={selected}>
      <span className="choice-text">
        <span className="choice-label">{label}</span>
        {hint && <span className="choice-hint">{hint}</span>}
      </span>
      {selected !== undefined && <span className="check" aria-hidden="true" />}
    </button>
  )
}
