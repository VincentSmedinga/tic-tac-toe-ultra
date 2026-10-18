/**
 * Light or dark follows the system unless the person picks one; that choice is kept per device.
 * public/appearance.js applies it before the first paint, so a dark phone never flashes light;
 * this module keeps it up to date afterwards. Keep the two in sync.
 *
 * The menu shows two choices, Licht and Donker, on top of three states (the model in Lea Verou's
 * https://lea.verou.me/blog/2026/dark-mode-toggles-two-states-are-enough/, as in Blokhut): see
 * `chooseScheme`.
 */

export type SchemePreference = 'system' | 'light' | 'dark'
export type Scheme = 'light' | 'dark'

const STORAGE_KEY = 'tic-tac-toe-ultra.scheme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

// Storage is passed in by tests; otherwise localStorage is read inside the try, because merely
// touching it throws when the browser blocks storage (Safari with "Block all cookies").

export function readPreference(storage?: Storage): SchemePreference {
  try {
    const value = (storage ?? localStorage).getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function savePreference(preference: SchemePreference, storage?: Storage): void {
  try {
    const store = storage ?? localStorage
    if (preference === 'system') store.removeItem(STORAGE_KEY)
    else store.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage can be blocked; the choice then lasts until the page reloads.
  }
}

export function resolveScheme(preference: SchemePreference, systemIsDark: boolean): Scheme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light'
  return preference
}

/**
 * What to keep when someone picks a scheme: the choice, unless it is what the system gives anyway,
 * which goes back to following the system. So a stored choice is always a deliberate difference
 * from the system, and the system is never out of reach. Only a press on a button calls this: a
 * stored choice that happens to match the system later on (it changed, not the person) is kept.
 */
export function chooseScheme(wanted: Scheme, systemIsDark: boolean): SchemePreference {
  return wanted === resolveScheme('system', systemIsDark) ? 'system' : wanted
}

/** Gives the browser's bar the colour of the page (`--chrome`, which a look may set itself). */
export function syncChrome(root: HTMLElement = document.documentElement): void {
  const colour = getComputedStyle(root).getPropertyValue('--chrome').trim()
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta && colour) meta.content = colour
}

/** Puts the scheme on <html>, where the tokens and the looks hang on it. */
export function applyScheme(scheme: Scheme, root: HTMLElement = document.documentElement): void {
  root.dataset.scheme = scheme
  syncChrome(root)
}
