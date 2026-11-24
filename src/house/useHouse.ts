import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { parseHouseServerMessage } from '../../shared/house-protocol.ts'
import type { HouseClientMessage, HouseErrorCode, HouseState } from '../../shared/house-protocol.ts'
import type { ShapeId } from '../../shared/shapes.ts'
import { RECONNECT_DELAYS_MS } from '../online/useRoom.ts'
import type { Connection } from '../online/useRoom.ts'
import type { HouseApi } from './api.ts'
import { houseApi } from './api.ts'

/** The WebSocket close codes the house uses (server/house-session.ts). */
const CLOSE_REPLACED = 4001
const CLOSE_HOUSE_FULL = 4409

/** What went wrong with the house itself: the codes of the server, plus three only the app knows. */
export type HouseProblem = HouseErrorCode | 'unknown-house' | 'replaced' | 'unreachable'

/**
 * Problems that are only news: the house goes on. They are about something this person tried, or
 * about an invitation, and are gone with the next thing they do.
 */
export const NOTICES = [
  'shape-taken',
  'not-joined',
  'not-free',
  'shape-needed',
  'no-invitation',
  'invitation-off',
  'no-room',
] as const satisfies readonly HouseProblem[]
export type HouseNotice = (typeof NOTICES)[number]

export function isNotice(problem: HouseProblem | null): problem is HouseNotice {
  return NOTICES.some((notice) => notice === problem)
}

/** Problems that trying again won't solve. */
const FINAL: readonly HouseProblem[] = [
  'unknown-house',
  'house-full',
  'replaced',
  'invalid-message',
]

export interface HouseView {
  connection: Connection
  /** The house as it is now; null until it has said so. */
  state: HouseState | null
  problem: HouseProblem | null
  retry: () => void
  send: (message: HouseClientMessage) => void
}

export interface HouseDeps {
  api: HouseApi
  createSocket: (code: string) => WebSocket
}

export const browserHouseDeps: HouseDeps = {
  api: houseApi,
  createSocket: (code) => {
    const url = new URL(`/api/houses/${code}/ws`, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return new WebSocket(url)
  },
}

/** Who comes in: the token of this browser, the name typed, and the shape of last time. */
export interface HouseIdentity {
  token: string
  name: string
  shape: ShapeId | null
}

interface HookState {
  connection: Connection
  state: HouseState | null
  problem: HouseProblem | null
}

type HookAction =
  | { type: 'connecting' }
  | { type: 'open' }
  | { type: 'closed'; problem?: HouseProblem }
  | { type: 'state'; state: HouseState }
  | { type: 'problem'; problem: HouseProblem | null }
  | { type: 'sent' }

const START: HookState = { connection: 'connecting', state: null, problem: null }

function reduce(previous: HookState, action: HookAction): HookState {
  switch (action.type) {
    case 'connecting':
      return { ...previous, connection: 'connecting', problem: null }
    case 'open':
      return { ...previous, connection: 'open' }
    case 'closed':
      return { ...previous, connection: 'closed', problem: action.problem ?? previous.problem }
    case 'state':
      // A state means the last message was taken: a problem with a shape is over.
      return {
        ...previous,
        state: action.state,
        problem: previous.problem === 'shape-taken' ? null : previous.problem,
      }
    case 'problem':
      return { ...previous, problem: action.problem }
    case 'sent':
      // Doing something new puts away the news about what happened before.
      return isNotice(previous.problem) ? { ...previous, problem: null } : previous
  }
}

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener)
  return () => {
    document.removeEventListener('visibilitychange', listener)
  }
}

/** Whether the page can be seen: a phone with the app in the background can't. */
function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true,
  )
}

/**
 * One person's connection to a house, once they have said who they are (`identity`): it asks
 * whether the house exists, opens the socket and comes in. A house shows who has it open, so the
 * socket is closed while the page can't be seen and opened again when it can: the others see a
 * person go when they put the app away. A lost connection is tried again by itself.
 */
export function useHouse(
  code: string,
  identity: HouseIdentity | null,
  deps: HouseDeps = browserHouseDeps,
): HouseView {
  const [view, dispatch] = useReducer(reduce, START)
  const [attempt, setAttempt] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  const failuresRef = useRef(0)
  const visible = usePageVisible()

  useEffect(() => {
    if (identity === null || !visible) return
    const session = { active: true }
    let socket: WebSocket | null = null
    dispatch({ type: 'connecting' })

    void (async () => {
      let exists: boolean
      try {
        exists = await deps.api.houseExists(code)
      } catch {
        if (session.active) dispatch({ type: 'closed', problem: 'unreachable' })
        return
      }
      if (!session.active) return
      if (!exists) {
        dispatch({ type: 'closed', problem: 'unknown-house' })
        return
      }

      socket = deps.createSocket(code)
      socketRef.current = socket
      socket.onopen = () => {
        if (!session.active) return
        failuresRef.current = 0
        dispatch({ type: 'open' })
        const { token, name, shape } = identity
        const join: HouseClientMessage = { type: 'join', token, name, ...(shape ? { shape } : {}) }
        socket?.send(JSON.stringify(join))
      }
      socket.onmessage = (event) => {
        if (!session.active) return
        const message = parseHouseServerMessage(event.data)
        if (!message) return
        if (message.type === 'state') dispatch({ type: 'state', state: message })
        else dispatch({ type: 'problem', problem: message.error })
      }
      socket.onclose = (event) => {
        if (!session.active) return
        if (event.code === CLOSE_REPLACED) dispatch({ type: 'closed', problem: 'replaced' })
        else if (event.code === CLOSE_HOUSE_FULL)
          dispatch({ type: 'closed', problem: 'house-full' })
        else dispatch({ type: 'closed' })
      }
    })()

    return () => {
      session.active = false
      socket?.close()
      socketRef.current = null
    }
  }, [code, deps, identity, visible, attempt])

  const retry = useCallback(() => {
    failuresRef.current = 0
    setAttempt((value) => value + 1)
  }, [])

  // A lost connection comes back by itself, after a wait that grows with every failed try.
  const { connection, problem } = view
  useEffect(() => {
    if (identity === null || !visible || connection !== 'closed') return
    if (problem !== null && FINAL.includes(problem)) return
    const delay =
      RECONNECT_DELAYS_MS[Math.min(failuresRef.current, RECONNECT_DELAYS_MS.length - 1)] ?? 8000
    failuresRef.current += 1
    const timer = window.setTimeout(() => {
      setAttempt((value) => value + 1)
    }, delay)
    const online = () => {
      setAttempt((value) => value + 1)
    }
    window.addEventListener('online', online)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', online)
    }
  }, [connection, problem, identity, visible])

  const send = useCallback((message: HouseClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return
    dispatch({ type: 'sent' })
    socket.send(JSON.stringify(message))
  }, [])

  return { ...view, retry, send }
}
