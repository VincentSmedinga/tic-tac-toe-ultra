import { useCallback, useEffect, useState } from 'react'

/** What the history entry of the mode holds, so back can tell it from the entries of the screens. */
const MARK = 'playMode'

function marked(): boolean {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && MARK in state
}

/**
 * Makes everything on the page that is not the layer, nor holds it, `inert`: out of the tab order,
 * out of reach of a pointer and hidden from screen readers. Returns what puts it back, leaving
 * alone what was inert already.
 */
function inertAround(layer: HTMLElement): () => void {
  const changed: Element[] = []
  for (let node: HTMLElement = layer; node !== document.body;) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of parent.children) {
      if (sibling !== node && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '')
        changed.push(sibling)
      }
    }
    node = parent
  }
  return () => {
    for (const element of changed) element.removeAttribute('inert')
  }
}

/** A field that is scrolled in its frame starts in the middle again when the frame changes size. */
function centre(layer: HTMLElement | null): void {
  const frame = layer?.querySelector<HTMLElement>('.board-frame')
  if (!frame) return
  frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2
  frame.scrollTop = (frame.scrollHeight - frame.clientHeight) / 2
}

/** Keeps the screen awake while the mode is on, where the browser has the Screen Wake Lock API. */
function keepAwake(): () => void {
  if (!('wakeLock' in navigator)) return () => undefined
  let lock: WakeLockSentinel | null = null
  let stopped = false
  const request = () => {
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (stopped) void sentinel.release()
        else lock = sentinel
      })
      .catch(() => undefined)
  }
  // The browser lets go of the lock when the page is hidden: ask again when it is back.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && (!lock || lock.released)) request()
  }
  request()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisible)
    void lock?.release()
  }
}

export interface PlayMode {
  /** Whether the mode is on. */
  on: boolean
  /** The `ref` of the section that is the layer. */
  attachLayer: (element: HTMLElement | null) => void
  /** The `ref` of the button that opens the mode, which gets the focus back when it ends. */
  attachTrigger: (element: HTMLButtonElement | null) => void
  toggle: () => void
  close: () => void
}

/**
 * The play mode of a game screen: the section that holds the board becomes a layer over the whole
 * page (CSS, `data-play-mode`), where the browser has it the real Fullscreen API is asked for on
 * top, and the rest of the page is `inert` and locked while it is on. The mode is a state in the
 * history, so back closes the mode and not the game; Escape, the button and F (on the board) do too,
 * and it ends by itself when the game screen goes away. See docs/plan.md, Full screen.
 */
export function usePlayMode(): PlayMode {
  const [on, setOn] = useState(false)
  // The two elements, kept as they come and go (state, so that the effects follow them).
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)

  const finish = useCallback(() => {
    setOn(false)
  }, [])

  const close = useCallback(() => {
    if (!on) return
    // Going back closes the mode through the popstate listener. Without our entry in the history
    // (a reload kept the state but lost the mode) there is nothing to go back to.
    if (marked()) window.history.back()
    else finish()
  }, [on, finish])

  const open = useCallback(() => {
    if (on) return
    window.history.pushState({ [MARK]: true }, '')
    setOn(true)
    // The real full screen, only where the browser has it (not an iPhone) and has to be asked
    // for in the tap itself. When it is refused, the mode is the same without it.
    if (document.fullscreenEnabled) layer?.requestFullscreen().catch(() => undefined)
  }, [on, layer])

  const toggle = useCallback(() => {
    if (on) close()
    else open()
  }, [on, close, open])

  // F on the board, like the button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.board')) return
      if (!layer?.contains(target)) return
      event.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [layer, toggle])

  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    root.setAttribute('data-play-mode', '')
    const element = layer
    const returnTo = trigger
    const restore = element ? inertAround(element) : () => undefined
    const release = keepAwake()

    // The focus goes to the board, to the cell the keyboard was on, unless it is on the board already.
    if (element && !element.querySelector('.board')?.contains(document.activeElement)) {
      element.querySelector<HTMLElement>('.board [tabindex="0"]')?.focus({ preventScroll: true })
    }
    // After the focus, which would scroll to its cell: the field starts in the middle, as it does.
    centre(element)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPopState = () => {
      if (!marked()) finish()
    }
    // In the real full screen Escape is the browser's: it ends the full screen and tells us.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) close()
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('popstate', onPopState)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      release()
      restore()
      root.removeAttribute('data-play-mode')
      centre(element)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      returnTo?.focus()
    }
  }, [on, layer, trigger, close, finish])

  // The game screen goes away while the mode is on (a lost room, the shapes to choose again): the
  // entry in the history goes with it. When the mode ends by itself the entry is gone already, and a
  // screen reached by an address left it behind.
  useEffect(() => {
    if (!on) return
    return () => {
      if (marked()) window.history.back()
    }
  }, [on])

  return { on, attachLayer: setLayer, attachTrigger: setTrigger, toggle, close }
}
