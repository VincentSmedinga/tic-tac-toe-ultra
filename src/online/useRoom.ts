import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { parseServerMessage } from '../../shared/protocol.ts'
import type { ClientMessage, ErrorCode, StateMessage } from '../../shared/protocol.ts'
import type { ShapeId } from '../../shared/shapes.ts'
import type { RoomApi } from './api.ts'
import { roomApi } from './api.ts'

/** The WebSocket close codes the room uses (server/room-session.ts). */
const CLOSE_REPLACED = 4001
const CLOSE_UNKNOWN_ROOM = 4404

/** Where a player stands: looking for the room, connected, or cut off. */
export type Connection = 'connecting' | 'open' | 'closed'

/** What went wrong with the room itself; the codes of the server, plus two that only the client knows. */
export type RoomProblem = ErrorCode | 'unknown-room' | 'replaced' | 'unreachable'

export interface RoomView {
  connection: Connection
  /** The room as it is now; null until the room has said so. */
  state: StateMessage | null
  problem: RoomProblem | null
  /** Try again after the connection was lost. */
  retry: () => void
  send: (message: ClientMessage) => void
}

export interface RoomDeps {
  api: RoomApi
  createSocket: (code: string) => WebSocket
}

export const browserDeps: RoomDeps = {
  api: roomApi,
  createSocket: (code) => {
    const url = new URL(`/api/rooms/${code}/ws`, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return new WebSocket(url)
  },
}

/**
 * What stops the game for a player, as opposed to a mistake with one move: a full room, and a
 * message the room could not read (a join with a name or a token it refuses would otherwise leave
 * the page waiting for ever).
 */
const STOPS_THE_GAME: readonly ErrorCode[] = ['room-full', 'game-started', 'invalid-message']

interface HookState {
  connection: Connection
  state: StateMessage | null
  problem: RoomProblem | null
}

type HookAction =
  | { type: 'reset' }
  /** Another try after the connection was lost: what is on screen stays. */
  | { type: 'reconnecting' }
  | { type: 'open' }
  | { type: 'closed'; problem?: RoomProblem }
  | { type: 'state'; state: StateMessage }
  | { type: 'problem'; problem: RoomProblem }

/** How long to wait before the next try after a lost connection: quick at first, then calmer. */
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000]

/** Problems that trying again won't solve: the room is gone or full, or this player is elsewhere. */
const FINAL_PROBLEMS: readonly RoomProblem[] = [
  'unknown-room',
  'room-full',
  'game-started',
  'replaced',
]

const START: HookState = { connection: 'connecting', state: null, problem: null }

function reduce(previous: HookState, action: HookAction): HookState {
  switch (action.type) {
    case 'reset':
      return { ...START, state: previous.state }
    case 'reconnecting':
      return { ...previous, connection: 'connecting', problem: null }
    case 'open':
      return { ...previous, connection: 'open' }
    case 'closed':
      return { ...previous, connection: 'closed', problem: action.problem ?? previous.problem }
    case 'state':
      return { ...previous, state: action.state }
    case 'problem':
      return { ...previous, problem: action.problem }
  }
}

/**
 * One player's connection to a room: first it asks whether the room exists (a refused WebSocket
 * can't say why), then it opens the socket and joins with the token and the name of this browser.
 * A new room code means a new hook (give the component a `key`); `retry` starts over.
 */
export function useRoom(
  code: string,
  identity: { token: string; name: string; shape?: ShapeId | null },
  deps: RoomDeps = browserDeps,
): RoomView {
  const [view, dispatch] = useReducer(reduce, START)
  const [attempt, setAttempt] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  // How many tries in a row failed; it starts again from nothing when a connection opens.
  const failuresRef = useRef(0)

  useEffect(() => {
    // What the callbacks below check, so that a socket that is already replaced stays quiet.
    const session = { active: true }
    let socket: WebSocket | null = null

    void (async () => {
      let exists: boolean
      try {
        exists = await deps.api.roomExists(code)
      } catch {
        if (session.active) dispatch({ type: 'closed', problem: 'unreachable' })
        return
      }
      if (!session.active) return
      if (!exists) {
        dispatch({ type: 'closed', problem: 'unknown-room' })
        return
      }

      socket = deps.createSocket(code)
      socketRef.current = socket
      socket.onopen = () => {
        if (!session.active) return
        failuresRef.current = 0
        dispatch({ type: 'open' })
        const { token, name, shape } = identity
        const join: ClientMessage = {
          type: 'join',
          token,
          ...(name === '' ? {} : { name }),
          // The shape this browser had last time: the room takes it when it is free.
          ...(shape ? { shape } : {}),
        }
        socket?.send(JSON.stringify(join))
      }
      socket.onmessage = (event) => {
        if (!session.active) return
        const message = parseServerMessage(event.data)
        if (!message) return
        if (message.type === 'state') dispatch({ type: 'state', state: message })
        // The other errors are about a move, which the playing screen shows.
        else if (STOPS_THE_GAME.includes(message.error))
          dispatch({ type: 'problem', problem: message.error })
      }
      socket.onclose = (event) => {
        if (!session.active) return
        if (event.code === CLOSE_UNKNOWN_ROOM) dispatch({ type: 'closed', problem: 'unknown-room' })
        else if (event.code === CLOSE_REPLACED) dispatch({ type: 'closed', problem: 'replaced' })
        else dispatch({ type: 'closed' })
      }
    })()

    return () => {
      session.active = false
      socket?.close()
      socketRef.current = null
    }
  }, [code, deps, attempt, identity])

  const retry = useCallback(() => {
    failuresRef.current = 0
    dispatch({ type: 'reset' })
    setAttempt((value) => value + 1)
  }, [])

  // A lost connection comes back by itself: after a short wait that grows with every failed try,
  // and at once when the phone is awake again or the network is back.
  const { connection, problem } = view
  useEffect(() => {
    const lost = connection === 'closed' && (problem === null || !FINAL_PROBLEMS.includes(problem))
    if (!lost || problem === 'invalid-message') return

    const tryAgain = () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', tryAgain)
      dispatch({ type: 'reconnecting' })
      setAttempt((value) => value + 1)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryAgain()
    }
    const delay =
      RECONNECT_DELAYS_MS[Math.min(failuresRef.current, RECONNECT_DELAYS_MS.length - 1)] ?? 8000
    failuresRef.current += 1
    const timer = window.setTimeout(tryAgain, delay)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', tryAgain)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', tryAgain)
    }
  }, [connection, problem])

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  return { ...view, retry, send }
}
