import { useEffect } from 'react'
import { applyLook, readLook } from './look.ts'
import { DARK_QUERY, applyScheme, readPreference, resolveScheme } from './scheme.ts'

/**
 * Keeps the page in the look that was chosen and in light or dark, on every screen. The choices are
 * made on the settings page, but the system can change its mind anywhere (the evening comes), and
 * until somebody has picked light or dark the page follows it. public/appearance.js did the first
 * one before the first paint.
 */
export function AppearanceSync() {
  useEffect(() => {
    applyLook(readLook())
    const query = matchMedia(DARK_QUERY)
    const update = () => {
      applyScheme(resolveScheme(readPreference(), query.matches))
    }
    update()
    query.addEventListener('change', update)
    return () => {
      query.removeEventListener('change', update)
    }
  }, [])
  return null
}
