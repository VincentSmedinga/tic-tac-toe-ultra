import { useEffect, useState } from 'react'
import { setAnimations, useAnimations, useReducedMotion } from '../motion/preference.ts'
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
import './AppearanceControls.css'

const SCHEMES = [
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
] as const

/**
 * The choices about how the game looks, kept per device: the theme (a look, of which there are
 * three), light or dark, and whether the game may move. They live in the footer, which has a place of its own on every screen.
 * Light or dark has two buttons, of which the one you see is pressed; there is no "Systeem": see
 * `chooseScheme`. Both are applied as soon as the page has loaded; public/appearance.js did it
 * before the first paint.
 */
export function AppearanceControls() {
  const [look, setLook] = useState<LookId>(() => readLook())
  const [preference, setPreference] = useState<SchemePreference>(() => readPreference())
  const [systemIsDark, setSystemIsDark] = useState(() => matchMedia(DARK_QUERY).matches)
  const scheme = resolveScheme(preference, systemIsDark)
  const animations = useAnimations()
  const reducedMotion = useReducedMotion()

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
    <section className="appearance" aria-label="Uiterlijk">
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
      <Segmented
        label="Animaties"
        options={[
          {
            value: 'on',
            label: 'Aan',
            // A phone that asks for less motion gets a fade and no moving strokes.
            hint: reducedMotion
              ? 'Je apparaat vraagt om minder beweging: alleen zacht verschijnen'
              : undefined,
          },
          { value: 'off', label: 'Uit' },
        ]}
        value={animations ? 'on' : 'off'}
        onChange={(wanted) => {
          setAnimations(wanted === 'on')
        }}
      />
    </section>
  )
}
