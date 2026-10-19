import { rules } from '../logic/triage'

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
              <span key={i} className={i < step ? 'dot on' : 'dot'} />
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
