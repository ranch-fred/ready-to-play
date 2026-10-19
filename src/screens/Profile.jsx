import { useState } from 'react'
import { Screen } from '../components/Screen'

export function Profile({ initial, onSave, onBack }) {
  const [name, setName] = useState(initial?.name || '')
  const [town, setTown] = useState(initial?.town || '')
  const ready = name.trim().length > 0

  return (
    <Screen
      onBack={onBack}
      title="Almost done"
      subtitle="This stays on your phone. No email or password."
      footer={
        <button className="btn primary" disabled={!ready} onClick={() => onSave({ name: name.trim(), town: town.trim() })}>
          See my recovery
        </button>
      }
    >
      <label className="field">
        <span>First name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Alex" />
      </label>
      <label className="field">
        <span>Town <em>(optional)</em></span>
        <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="So we can show care nearby" />
      </label>
    </Screen>
  )
}
