import { useSyncExternalStore } from 'react'
import { roomCodeSchema } from '../../shared/protocol.ts'

/** Where in the app we are: the start screen, the game on one screen, or a room. */
export type Route =
  { name: 'start'; notice?: 'bad-code' } | { name: 'local' } | { name: 'room'; code: string }

/** Reads an address of the app; anything it doesn't know is the start screen. */
export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 1 && parts[0] === 'samen') return { name: 'local' }
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

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

/** Goes to another address of the app without loading the page again. */
export function navigate(path: string): void {
  window.history.pushState(null, '', path)
  for (const listener of listeners) listener()
  window.scrollTo(0, 0)
}

function pathname(): string {
  return window.location.pathname
}

/** The route of the address in the browser, and it changes with the address. */
export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, pathname)
  return parseRoute(path)
}
