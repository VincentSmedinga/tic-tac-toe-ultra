import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { roomCodeSchema } from '../../shared/protocol.ts'
import { pushEntry } from './scroll.ts'

/** Where in the app we are: the start screen, the game on one screen, a room, played games, the statistics, or the settings. */
export type Route =
  | { name: 'start'; notice?: 'bad-code' }
  | { name: 'local' }
  | { name: 'room'; code: string }
  | { name: 'games' }
  | { name: 'stats' }
  | { name: 'settings' }
  /** The replay of one finished game; whether the id is a game is up to the server. */
  | { name: 'game'; id: string }

/** Reads an address of the app; anything it doesn't know is the start screen. */
export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 1 && parts[0] === 'samen') return { name: 'local' }
  if (parts.length === 1 && parts[0] === 'spellen') return { name: 'games' }
  if (parts.length === 1 && parts[0] === 'statistieken') return { name: 'stats' }
  if (parts.length === 1 && parts[0] === 'instellingen') return { name: 'settings' }
  if (parts.length === 2 && parts[0] === 'spel') return { name: 'game', id: parts[1] ?? '' }
  if (parts.length === 2 && parts[0] === 'kamer') {
    const code = (parts[1] ?? '').toUpperCase()
    return roomCodeSchema.safeParse(code).success
      ? { name: 'room', code }
      : { name: 'start', notice: 'bad-code' }
  }
  return { name: 'start' }
}

export function roomPath(code: string): string {
  return `/kamer/${code}`
}

export function gamePath(id: string): string {
  return `/spel/${encodeURIComponent(id)}`
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

/**
 * Goes to another address of the app without loading the page again. Where the browser can, the
 * old screen slides away and the new one comes in (a view transition, which the style decides
 * the look of, or switches off); everywhere else the new screen is simply there. The new screen
 * starts at the top, and the place on the old one is kept for when back comes to it (`scroll.ts`).
 */
export function navigate(path: string): void {
  const go = () => {
    pushEntry(path)
    for (const listener of listeners) listener()
    window.scrollTo(0, 0)
  }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!calm && typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      flushSync(go)
    })
  } else {
    go()
  }
}

function pathname(): string {
  return window.location.pathname
}

/** The route of the address in the browser, and it changes with the address. */
export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, pathname)
  return parseRoute(path)
}
