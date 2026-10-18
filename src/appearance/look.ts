import { syncChrome } from './scheme.ts'

/**
 * The look of the game, which everyone chooses for themselves: three ways to dress the same
 * screens (their names are in the dictionaries, `look.<id>.name`). It is kept per device and ends up as `data-look` on <html>, which the looks in
 * `styles/look-*.css` hang on; public/appearance.js sets it before the first paint. Keep the two in
 * sync.
 */
export const LOOKS = [{ id: 'drawn' }, { id: 'playful' }, { id: 'calm' }] as const

export type LookId = (typeof LOOKS)[number]['id']

export const DEFAULT_LOOK: LookId = 'drawn'

const STORAGE_KEY = 'tic-tac-toe-ultra.look'

export function isLook(value: string | null): value is LookId {
  return LOOKS.some(({ id }) => id === value)
}

export function readLook(storage?: Storage): LookId {
  try {
    const value = (storage ?? localStorage).getItem(STORAGE_KEY)
    return isLook(value) ? value : DEFAULT_LOOK
  } catch {
    return DEFAULT_LOOK
  }
}

export function saveLook(look: LookId, storage?: Storage): void {
  try {
    ;(storage ?? localStorage).setItem(STORAGE_KEY, look)
  } catch {
    // Storage can be blocked; the choice then lasts until the page reloads.
  }
}

export function applyLook(look: LookId, root: HTMLElement = document.documentElement): void {
  root.dataset.look = look
  syncChrome(root)
}
