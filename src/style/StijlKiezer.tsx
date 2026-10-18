import { useState } from 'react'
import { STIJLEN, currentStijl, setStijl } from './stijl.ts'
import type { StijlId } from './stijl.ts'
import './StijlKiezer.css'

/** Switches between the three styles that are being compared; it goes away once one is chosen. */
export function StijlKiezer() {
  const [active, setActive] = useState<StijlId>(() => {
    const id = currentStijl()
    setStijl(id)
    return id
  })
  return (
    <div className="stijl-kiezer" role="group" aria-label="Stijl om te vergelijken">
      <span>Stijl</span>
      {STIJLEN.map(({ id, name, hint }) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          title={hint}
          onClick={() => {
            setStijl(id)
            setActive(id)
          }}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
