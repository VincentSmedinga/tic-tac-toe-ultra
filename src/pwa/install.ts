/**
 * Adding the game to a home screen. Chrome and Edge offer to install it themselves and let us
 * ask for it with a button of our own (`beforeinstallprompt`); iPad and iPhone (Safari) have no
 * such thing, so there a small hint says where to tap. Neither is shown in the installed app.
 * The tip can be closed for good, kept in localStorage with a fallback to memory like the rest of
 * what a browser remembers (online/identity.ts).
 */

import { useSyncExternalStore } from 'react'

const DISMISSED_KEY = 'tic-tac-toe-ultra.install-tip-closed'

let memoryDismissed = false

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isTipDismissed(): boolean {
  try {
    if (storage()?.getItem(DISMISSED_KEY) === 'yes') return true
  } catch {
    // Fall back to what was closed this visit.
  }
  return memoryDismissed
}

export function dismissTip(): void {
  memoryDismissed = true
  try {
    storage()?.setItem(DISMISSED_KEY, 'yes')
  } catch {
    // Not remembered, but it stays closed for this visit.
  }
  announce()
}

/** Brings the tip back, as if it had never been closed; for the tests. */
export function forgetTip(): void {
  memoryDismissed = false
  try {
    storage()?.removeItem(DISMISSED_KEY)
  } catch {
    // Nothing to forget.
  }
  announce()
}

/** The game was opened from the home screen: it has no address bar, and nothing to install. */
export function isStandalone(): boolean {
  const iosFlag = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosFlag || window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Safari on an iPhone or iPad, where "Zet op beginscherm" is in the share sheet. An iPad that
 * asks for the desktop site says it is a Mac, but a Mac has no touch screen. Other browsers on
 * iOS leave their own name in the user agent.
 */
export function isIosSafari(): boolean {
  const { userAgent, maxTouchPoints } = navigator
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
  return ios && userAgent.includes('Safari') && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(userAgent)
}

/** What Chrome gives us to ask the person with, when the app can be installed. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function announce() {
  for (const listener of listeners) listener()
}

/** Starts listening; the event can come before the first screen is on the page. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep it for the button, instead of the browser's own bar.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    announce()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    announce()
  })
}

/** Asks the person to install the app; the browser lets that happen once per event. */
export async function install(): Promise<void> {
  const event = deferred
  if (!event) return
  deferred = null
  announce()
  await event.prompt()
  await event.userChoice
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether the browser can install the app right now. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null)
}

/** Whether the iOS tip is open: iOS Safari, not installed, and not closed before. */
export function useShowIosTip(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !isTipDismissed() && !isStandalone() && isIosSafari(),
  )
}
