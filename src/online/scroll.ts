import { useLayoutEffect } from 'react'

/**
 * Where the page is, for every address the browser has in its history. The browser would put the
 * page back by itself on going back, but it does that before the screen has been drawn (or, for a
 * list that is fetched, before it has its height), so it lands halfway. The app does it instead:
 * it says `manual`, remembers the place of every entry in the history, and puts the page there
 * once the screen is on.
 */

const KEY = 'entry'
const FALLBACK_MS = 1500

const positions = new Map<string, number>()
let current = ''
let started = false
let stopWaiting: (() => void) | null = null

function entryOf(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && KEY in state) {
    const id = (state as Record<string, unknown>)[KEY]
    if (typeof id === 'string') return id
  }
  return null
}

function newEntry(): string {
  return Math.random().toString(36).slice(2)
}

/** Puts the page at a place, and for a screen that is not tall enough yet, again as it grows. */
function restore(y: number): void {
  stopWaiting?.()
  window.scrollTo(0, y)
  if (Math.abs(window.scrollY - y) < 1 || typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver(() => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) < 1) stop()
  })
  // Whoever takes the page in their own hands, or has waited long enough, is left alone.
  const stop = () => {
    observer.disconnect()
    window.clearTimeout(timer)
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('keydown', stop)
    stopWaiting = null
  }
  const timer = window.setTimeout(stop, FALLBACK_MS)
  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  window.addEventListener('keydown', stop)
  observer.observe(document.documentElement)
  stopWaiting = stop
}

/** Starts remembering; once, before anything is shown. */
function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.history.scrollRestoration = 'manual'
  const existing = entryOf(window.history.state)
  current = existing ?? newEntry()
  if (existing === null) {
    const state: unknown = window.history.state
    const rest = typeof state === 'object' && state !== null ? state : {}
    window.history.replaceState({ ...rest, [KEY]: current }, '')
  }

  window.addEventListener(
    'scroll',
    () => {
      positions.set(current, window.scrollY)
    },
    { passive: true },
  )
  // Before the screen of the address that was popped is drawn: this listener is the first one, so
  // the page is still where the old entry left it. An entry of our own that holds no address of a
  // screen (the full screen mode's) has no id, and the entry we were on is then still the one.
  window.addEventListener('popstate', (event) => {
    const next = entryOf(event.state)
    if (next === null || next === current) return
    positions.set(current, window.scrollY)
    current = next
    const y = positions.get(next) ?? 0
    // After the screen is drawn: React does that when the event is over, before the next frame.
    window.requestAnimationFrame(() => {
      restore(y)
    })
  })
}

start()

/** Leaving an address by a link: its place is remembered, and the new entry begins at the top. */
export function pushEntry(path: string): void {
  // The entry the page is on, when somebody else made it (a test, an address that was typed).
  current = entryOf(window.history.state) ?? current
  positions.set(current, window.scrollY)
  stopWaiting?.()
  current = newEntry()
  window.history.pushState({ [KEY]: current }, '', path)
  positions.set(current, 0)
}

/**
 * A new view of a screen starts at the top: the lobby that becomes the game, the picker that
 * becomes the board. They are one address, so the router never sees them, and the page, which
 * was scrolled to the button that led here, would keep its place on a shorter page, with the foot
 * in view and half of the board. Not a move, not a message and not a rematch: only the view
 * itself. Pass what the view is, and it runs when that changes (and when the screen is first shown,
 * where the page is at the top anyway).
 */
export function useScrollToTop(view?: string): void {
  useLayoutEffect(() => {
    stopWaiting?.()
    window.scrollTo(0, 0)
  }, [view])
}
