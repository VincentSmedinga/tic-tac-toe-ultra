import { useEffect, useRef, useState } from 'react'
import { LOOKS, applyLook, readLook, saveLook } from './look.ts'
import type { LookId } from './look.ts'
import {
  DARK_QUERY,
  applyScheme,
  chooseScheme,
  readPreference,
  resolveScheme,
  savePreference,
} from './scheme.ts'
import type { Scheme, SchemePreference } from './scheme.ts'
import { Segmented } from './Segmented.tsx'
import './AppearanceMenu.css'

const SCHEMES = [
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
] as const

/**
 * "Uiterlijk": a button at the corner of every screen that opens the two choices about how the
 * game looks, kept per device: the theme (a look, of which there are three) and light or dark.
 * Light or dark has two buttons, of which the one you see is pressed; there is no "Systeem": see
 * `chooseScheme`. Both are applied as soon as the page has loaded; public/appearance.js did it
 * before the first paint.
 */
export function AppearanceMenu() {
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState<LookId>(() => readLook())
  const [preference, setPreference] = useState<SchemePreference>(() => readPreference())
  const [systemIsDark, setSystemIsDark] = useState(() => matchMedia(DARK_QUERY).matches)
  const scheme = resolveScheme(preference, systemIsDark)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const query = matchMedia(DARK_QUERY)
    const update = () => {
      setSystemIsDark(query.matches)
    }
    update()
    query.addEventListener('change', update)
    return () => {
      query.removeEventListener('change', update)
    }
  }, [])

  // The look goes first: the browser's bar takes the colour of the scheme that is on top of it.
  useEffect(() => {
    applyLook(look)
  }, [look])

  useEffect(() => {
    applyScheme(scheme)
  }, [scheme, look])

  // Escape or a tap somewhere else closes the menu again, and the focus goes back to its button.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggle.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const chooseLook = (wanted: LookId) => {
    saveLook(wanted)
    setLook(wanted)
  }

  const chooseLightOrDark = (wanted: Scheme) => {
    if (wanted === scheme) return
    // The system is read now, not from state: a choice is judged when it is made, never afterwards.
    const next = chooseScheme(wanted, matchMedia(DARK_QUERY).matches)
    savePreference(next)
    setPreference(next)
  }

  return (
    <div className="appearance" ref={root}>
      {open && (
        <div className="appearance-panel" id="appearance-panel" role="group" aria-label="Uiterlijk">
          <Segmented
            label="Thema"
            options={LOOKS.map(({ id, name, hint }) => ({ value: id, label: name, hint }))}
            value={look}
            onChange={chooseLook}
          />
          <Segmented
            label="Licht of donker"
            options={SCHEMES}
            value={scheme}
            onChange={chooseLightOrDark}
          />
        </div>
      )}
      <button
        ref={toggle}
        type="button"
        className="appearance-toggle"
        aria-expanded={open}
        aria-controls="appearance-panel"
        onClick={() => {
          setOpen((was) => !was)
        }}
      >
        Uiterlijk
      </button>
    </div>
  )
}
