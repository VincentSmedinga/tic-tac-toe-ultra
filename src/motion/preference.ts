import { useSyncExternalStore } from 'react'

/**
 * Whether the game may move: a switch in the footer, kept per device, on top of the system's own
 * wish for less motion (`prefers-reduced-motion`). With the switch on and less motion asked for,
 * shapes only fade in; with it off, nothing moves at all.
 */

const STORAGE_KEY = 'tic-tac-toe-ultra.animations'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export type Motion = 'full' | 'gentle' | 'off'

// Storage is passed in by tests; otherwise localStorage is read inside the try, because merely
// touching it throws when the browser blocks storage.

export function readAnimations(storage?: Storage): boolean {
  try {
    return (storage ?? localStorage).getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveAnimations(on: boolean, storage?: Storage): void {
  try {
    const store = storage ?? localStorage
    if (on) store.removeItem(STORAGE_KEY)
    else store.setItem(STORAGE_KEY, 'off')
  } catch {
    // Storage can be blocked; the choice then lasts until the page reloads.
  }
}

/** What to do given the switch and the system's wish. */
export function resolveMotion(animations: boolean, reduced: boolean): Motion {
  if (!animations) return 'off'
  return reduced ? 'gentle' : 'full'
}

// With storage blocked a choice can't be read back, so it is also kept here.
let remembered: boolean | undefined
const listeners = new Set<() => void>()

function subscribeAnimations(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function snapshotAnimations(): boolean {
  return remembered ?? readAnimations()
}

/** Turns the animations on or off, for this device, and tells every screen that shows it. */
export function setAnimations(on: boolean): void {
  remembered = on
  saveAnimations(on)
  for (const listener of listeners) listener()
}

function subscribeReduced(listener: () => void): () => void {
  const query = matchMedia(REDUCED_QUERY)
  query.addEventListener('change', listener)
  return () => {
    query.removeEventListener('change', listener)
  }
}

function snapshotReduced(): boolean {
  return matchMedia(REDUCED_QUERY).matches
}

/** The switch in the footer: on or off. */
export function useAnimations(): boolean {
  return useSyncExternalStore(subscribeAnimations, snapshotAnimations)
}

/** Whether the system asks for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, snapshotReduced)
}

/** How the game moves right now. */
export function useMotion(): Motion {
  return resolveMotion(useAnimations(), useReducedMotion())
}

/** Forgets what this module remembered: for tests. */
export function resetAnimations(): void {
  remembered = undefined
}
