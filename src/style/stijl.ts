/**
 * The look of the game while three directions are being compared (issue #32): a prototype, not
 * the end result. The choice is kept in localStorage and can be set with `?stijl=a|b|c`; it ends up
 * as `data-stijl` on the page, which the styles in `styles/stijl-*.css` hang on.
 */
export const STIJLEN = [
  { id: 'a', name: 'Getekend', hint: 'warm, papier en stift' },
  { id: 'b', name: 'Speels', hint: 'kleurrijk, grote kaarten' },
  { id: 'c', name: 'Rustig', hint: 'groot, veel ruimte' },
] as const

export type StijlId = (typeof STIJLEN)[number]['id']

const KEY = 'tic-tac-toe-ultra.stijl'

export function isStijl(value: string | null): value is StijlId {
  return STIJLEN.some(({ id }) => id === value)
}

/** The style to show: from the address, else the one that was chosen last, else the first. */
export function currentStijl(): StijlId {
  const asked = new URLSearchParams(window.location.search).get('stijl')
  if (isStijl(asked)) return asked
  try {
    const saved = window.localStorage.getItem(KEY)
    if (isStijl(saved)) return saved
  } catch {
    // No storage: the first style.
  }
  return 'a'
}

export function setStijl(id: StijlId): void {
  document.documentElement.dataset.stijl = id
  try {
    window.localStorage.setItem(KEY, id)
  } catch {
    // Not remembered.
  }
}
