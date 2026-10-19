import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import type { ServerMessage, StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import {
  clearLastRoom,
  getLastRoom,
  getShape,
  getToken,
  setLastRoom,
  setName,
  setShape,
} from './identity.ts'
import { RoomPage } from './RoomPage.tsx'
import type { RoomDeps } from './useRoom.ts'

/** Enough of a WebSocket for the page, which the test drives by hand. */
class FakeSocket {
  readyState = 0
  readonly sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.readyState = 3
  }

  /** The server accepts the connection. */
  open() {
    this.readyState = 1
    act(() => this.onopen?.())
  }
  receive(message: ServerMessage | string) {
    act(() =>
      this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }),
    )
  }
  closeFromServer(code: number) {
    this.readyState = 3
    act(() => this.onclose?.({ code }))
  }
}

function setup(exists: boolean | Error = true) {
  const sockets: FakeSocket[] = []
  const roomExists = vi.fn(() =>
    exists instanceof Error ? Promise.reject(exists) : Promise.resolve(exists),
  )
  const deps: RoomDeps = {
    api: { createRoom: vi.fn(() => Promise.resolve('BCDF')), roomExists },
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
  }
  render(<RoomPage code="BCDF" deps={deps} />)
  return { sockets, roomExists, deps }
}

/** The room as a player sees it; the game is there once both seats have a shape. */
function state(
  players: StateMessage['players'],
  you = 'X',
  field = { width: 3, height: 3, winLength: 3 },
  seats = 2,
  /** The one who made the room has said "start", with seats left over. */
  startedEarly = false,
): StateMessage {
  const shapes = players.flatMap(({ shape }) => (shape ? [shape] : []))
  const everybodyChose = players.length >= 2 && shapes.length === players.length
  const started = everybodyChose && (startedEarly || players.length >= seats)
  return {
    type: 'state',
    code: 'BCDF',
    you,
    field,
    seats,
    round: 0,
    players,
    ...(started
      ? {
          config: {
            ...roomConfig(0, shapes, field),
            players: [...roomConfig(0, shapes, field).players],
          },
        }
      : {}),
    moves: [],
  }
}

async function connected(exists: boolean | Error = true) {
  const world = setup(exists)
  const socket = await vi.waitFor(() => {
    const first = world.sockets[0]
    if (!first) throw new Error('no socket yet')
    return first
  })
  socket.open()
  return { ...world, socket }
}

beforeEach(() => {
  window.localStorage.clear()
  clearLastRoom()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RoomPage', () => {
  it('asks whether the room exists, says it is connecting, and then joins with the token of this browser', async () => {
    const { sockets, roomExists } = setup()
    expect(screen.getByRole('status')).toHaveTextContent('Verbinden met de kamer')
    await vi.waitFor(() => {
      expect(sockets).toHaveLength(1)
    })
    expect(roomExists).toHaveBeenCalledWith('BCDF')

    sockets[0]?.open()
    expect(sockets[0]?.sent).toEqual([{ type: 'join', token: getToken() }])
  })

  it('joins with the name that was typed, without spaces around it', async () => {
    setName('  Anna ')
    const { socket } = await connected()
    expect(socket.sent).toEqual([{ type: 'join', token: getToken(), name: 'Anna' }])
  })

  it('cleans a name from storage that the room would refuse, instead of waiting for ever', async () => {
    window.localStorage.setItem('tic-tac-toe-ultra.name', 'An\u200Bna\u0007')
    window.localStorage.setItem('tic-tac-toe-ultra.token', 'short')
    const { socket } = await connected()
    expect(socket.sent).toEqual([{ type: 'join', token: getToken(), name: 'Anna' }])
    expect(getToken()).not.toBe('short')
  })

  it('says so, with a way to try again, when the room cannot read the join', async () => {
    const { socket } = await connected()
    socket.receive({ type: 'error', error: 'invalid-message' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Er ging iets mis')
    expect(screen.getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
  })

  describe('the way back to the room from the start screen', () => {
    it('is remembered once the room has given this player a seat', async () => {
      const { socket } = await connected()
      expect(getLastRoom()).toBeNull()
      socket.receive(state([{ id: 'X', shape: 'cross', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')
      expect(getLastRoom()).toBe('BCDF')
    })

    it.each([
      [
        'does not exist',
        () => {
          setup(false)
          return Promise.resolve()
        },
      ],
      [
        'is full',
        async () => {
          const { socket } = await connected()
          socket.receive({ type: 'error', error: 'room-full' })
        },
      ],
    ])('is forgotten when the room %s', async (_why, arrange) => {
      setLastRoom('BCDF')
      await arrange()
      await screen.findByRole('alert')
      // Forgetting it is an effect, which runs a moment after the message is on screen.
      await waitFor(() => {
        expect(getLastRoom()).toBeNull()
      })
    })

    it('is kept when the connection is only lost', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')
      socket.closeFromServer(1006)
      expect(getLastRoom()).toBe('BCDF')
    })
  })

  describe('leaving after the game', () => {
    const won = [
      { player: 'cross', x: 0, y: 0 },
      { player: 'circle', x: 0, y: 1 },
      { player: 'cross', x: 1, y: 0 },
      { player: 'circle', x: 1, y: 1 },
      { player: 'cross', x: 2, y: 0 },
    ]
    const players: StateMessage['players'] = [
      { id: 'X', shape: 'cross', connected: true },
      { id: 'O', shape: 'circle', connected: true },
    ]

    afterEach(() => {
      window.history.replaceState(null, '', '/')
    })

    it('says leave to the room, and when the room lets go forgets it and goes to the start', async () => {
      window.history.replaceState(null, '', '/kamer/BCDF')
      const user = userEvent.setup()
      const { socket } = await connected()
      socket.receive({ ...state(players), moves: won })
      expect(getLastRoom()).toBe('BCDF')

      await user.click(await screen.findByRole('button', { name: 'Stoppen' }))
      // The question first: nothing is sent until it is answered.
      expect(socket.sent).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Stoppen' }))
      expect(socket.sent.at(-1)).toEqual({ type: 'leave' })

      socket.closeFromServer(4410)
      await waitFor(() => {
        expect(window.location.pathname).toBe('/')
      })
      expect(getLastRoom()).toBeNull()
    })

    it('stays in the room when the question is answered with Blijven', async () => {
      const user = userEvent.setup()
      const { socket } = await connected()
      socket.receive({ ...state(players), moves: won })
      await user.click(await screen.findByRole('button', { name: 'Stoppen' }))
      await user.click(screen.getByRole('button', { name: 'Blijven' }))
      expect(socket.sent).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
      expect(getLastRoom()).toBe('BCDF')
    })

    it('waits for the connection: nobody can leave a room they are not in touch with', async () => {
      const { socket } = await connected()
      socket.receive({ ...state(players), moves: won })
      await screen.findByRole('button', { name: 'Stoppen' })
      socket.closeFromServer(1006)
      expect(await screen.findByRole('button', { name: 'Stoppen' })).toBeDisabled()
    })

    it('forgets the room when it says that you left it before', async () => {
      setLastRoom('BCDF')
      const { socket } = await connected()
      socket.receive({ type: 'error', error: 'left' })
      expect(await screen.findByRole('alert')).toHaveTextContent('Je hebt dit spel verlaten')
      await waitFor(() => {
        expect(getLastRoom()).toBeNull()
      })
      // It is final: the page does not keep trying to come back.
      socket.closeFromServer(4409)
      expect(screen.getByRole('alert')).toBeVisible()
    })
  })

  describe('while waiting for a second player', () => {
    it('shows the code and the link, and who is here', async () => {
      setName('Anna')
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', name: 'Anna', connected: true }]))

      expect(await screen.findByLabelText('Code B C D F')).toHaveTextContent('BCDF')
      expect(screen.getByText(`${window.location.origin}/kamer/BCDF`)).toBeVisible()
      expect(screen.getByText('Anna (kruis) – jij')).toBeVisible()
      expect(screen.getByText('Wachten op een tweede speler…')).toBeVisible()
    })

    it('shows a player without a name by their shape', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', connected: true }]))
      expect(await screen.findByText('Kruis – jij')).toBeVisible()
    })

    it('copies the link', async () => {
      const user = userEvent.setup()
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', connected: true }]))

      await user.click(await screen.findByRole('button', { name: 'Kopieer link' }))
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/kamer/BCDF`)
      expect(await screen.findByText('Link gekopieerd.')).toBeVisible()
    })

    it('says so when copying does not work', async () => {
      const user = userEvent.setup()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('no'))
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', connected: true }]))

      await user.click(await screen.findByRole('button', { name: 'Kopieer link' }))
      expect(await screen.findByText(/Kopiëren lukt niet/)).toBeVisible()
    })
  })

  describe('when the second player joins', () => {
    it('shows the board and who is who, as soon as the second player is there', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', shape: 'cross', name: 'Anna', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')

      socket.receive(
        state([
          { id: 'X', shape: 'cross', name: 'Anna', connected: true },
          { id: 'O', shape: 'circle', connected: true },
        ]),
      )
      expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(screen.getByText('Anna (jij)')).toBeVisible()
      expect(screen.getByText('Cirkel')).toBeVisible()
      expect(screen.queryByText('Wachten op een tweede speler…')).not.toBeInTheDocument()
    })

    it('shows who is not connected', async () => {
      const { socket } = await connected()
      socket.receive(
        state([
          { id: 'X', shape: 'cross', connected: true },
          { id: 'O', shape: 'circle', connected: false },
        ]),
      )
      expect(await screen.findByText(/Cirkel is even weg/)).toBeVisible()
    })
  })

  describe('the field of the room', () => {
    it('is said in the waiting room, with how many in a row win', async () => {
      const { socket } = await connected()
      socket.receive(
        state([{ id: 'X', connected: true }], 'X', { width: 7, height: 7, winLength: 5 }),
      )
      expect(await screen.findByText('Veld: 7 × 7, vijf op een rij')).toBeVisible()
    })

    it('is said while choosing shapes too, and the board has the size of the field', async () => {
      const { socket } = await connected()
      const field = { width: 5, height: 7, winLength: 5 }
      socket.receive(
        state(
          [
            { id: 'X', shape: 'cross', connected: true },
            { id: 'O', connected: true },
          ],
          'X',
          field,
        ),
      )
      expect(await screen.findByText('Veld: 5 × 7, vijf op een rij')).toBeVisible()

      socket.receive(
        state(
          [
            { id: 'X', shape: 'cross', connected: true },
            { id: 'O', shape: 'circle', connected: true },
          ],
          'X',
          field,
        ),
      )
      expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(35)
      expect(screen.getByText('5 × 7, vijf op een rij')).toBeVisible()
    })
  })

  describe('a room with more seats than people', () => {
    const anna = { id: 'X', name: 'Anna', shape: 'cross', connected: true } as const
    const bo = { id: 'O', name: 'Bo', shape: 'circle', connected: true } as const
    const cas = { id: '3', name: 'Cas', connected: true } as const
    const field = { width: 7, height: 7, winLength: 5 }

    it('shows the seats that are free, how many people play and the link to give them', async () => {
      const { socket } = await connected()
      socket.receive(state([anna], 'X', field, 4))
      expect(await screen.findByText('Plek 2: nog vrij')).toBeVisible()
      expect(screen.getByText('Plek 3: nog vrij')).toBeVisible()
      expect(screen.getByText('Plek 4: nog vrij')).toBeVisible()
      expect(screen.getByText(/Veld: 7 × 7, vijf op een rij · 4 spelers/)).toBeVisible()
      expect(screen.getByText('Wachten op meer spelers…')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Kopieer link' })).toBeVisible()
      expect(screen.queryByRole('button', { name: /^Start met/ })).not.toBeInTheDocument()
    })

    it('has a start button for the one who made the room, when two people have chosen', async () => {
      const { socket } = await connected()
      socket.receive(state([anna, bo], 'X', field, 4))
      const start = await screen.findByRole('button', { name: 'Start met 2 spelers' })
      expect(start).toBeEnabled()
      expect(screen.getByText(/Er zijn nog 2 plekken vrij/)).toBeVisible()

      await userEvent.setup().click(start)
      expect(socket.sent.at(-1)).toEqual({ type: 'start' })
    })

    it('says it right when one seat is left', async () => {
      const { socket } = await connected()
      socket.receive(state([anna, bo, { ...cas, shape: 'star' }], 'X', field, 4))
      expect(await screen.findByText(/Er is nog 1 plek vrij/)).toBeVisible()
    })

    it('waits with the button while somebody has not chosen a shape, and says who it waits for', async () => {
      const { socket } = await connected()
      socket.receive(state([anna, bo, cas], 'X', field, 4))
      expect(await screen.findByText('Cas kiest nog een vorm…')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Start met 3 spelers' })).toBeDisabled()
    })

    it('has no start button for the others, who are told who they wait for', async () => {
      const { socket } = await connected()
      socket.receive(state([anna, bo], 'O', field, 4))
      expect(await screen.findByText('Wachten tot Anna het spel start…')).toBeVisible()
      expect(screen.queryByRole('button', { name: /^Start met/ })).not.toBeInTheDocument()
    })

    it('has no start button when every seat is taken: the game starts by itself', async () => {
      const { socket } = await connected()
      const chosen = { ...cas, shape: 'star' } as const
      socket.receive(state([anna, bo, chosen], 'X', field, 3))
      expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(screen.queryByRole('button', { name: /^Start met/ })).not.toBeInTheDocument()
    })

    it('shows the board with three players when the game has started with a seat to spare', async () => {
      const { socket } = await connected()
      const chosen = { ...cas, shape: 'star' } as const
      socket.receive(state([anna, bo, chosen], 'X', field, 4, true))
      expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(document.querySelectorAll('.players-row .player')).toHaveLength(3)
      expect(screen.queryByRole('button', { name: /^Start met/ })).not.toBeInTheDocument()
    })

    it('says so, with no way to try again, when the game has started without you', async () => {
      const { socket } = await connected()
      socket.receive({ type: 'error', error: 'game-started' })
      socket.closeFromServer(4409)
      expect(await screen.findByRole('alert')).toHaveTextContent('al begonnen')
      expect(screen.queryByRole('button', { name: 'Opnieuw proberen' })).not.toBeInTheDocument()
    })
  })

  describe('choosing a shape', () => {
    const anna = { id: 'X', name: 'Anna', connected: true } as const
    const bo = { id: 'O', name: 'Bo', connected: true } as const

    it('is possible from the first moment, alone in the room, and is sent to the room', async () => {
      const { socket } = await connected()
      socket.receive(state([anna]))
      expect(await screen.findByRole('group', { name: 'Kies je vorm' })).toBeVisible()
      expect(screen.getByText('Wachten op een tweede speler…')).toBeVisible()

      await userEvent.setup().click(screen.getByRole('button', { name: 'hart' }))
      expect(socket.sent.at(-1)).toEqual({ type: 'choose', shape: 'heart' })
    })

    it('shows the shape that is chosen, and that somebody who has not chosen is still choosing', async () => {
      const { socket } = await connected()
      socket.receive(state([{ ...anna, shape: 'star' }, bo]))
      expect(await screen.findByText('Anna (ster) – jij')).toBeVisible()
      expect(screen.getByText('Bo – kiest nog')).toBeVisible()
      expect(screen.getByRole('button', { name: 'ster' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('does not show the board until both have chosen, and says who it waits for', async () => {
      const { socket } = await connected()
      socket.receive(state([{ ...anna, shape: 'star' }, bo]))
      expect(await screen.findByText('Bo kiest nog een vorm…')).toBeVisible()
      expect(screen.queryByRole('group', { name: 'Speelveld' })).not.toBeInTheDocument()

      socket.receive(
        state([
          { ...anna, shape: 'star' },
          { ...bo, shape: 'heart' },
        ]),
      )
      expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(screen.queryByRole('group', { name: 'Kies je vorm' })).not.toBeInTheDocument()
    })

    it('asks you to choose when it is you who has not', async () => {
      const { socket } = await connected()
      socket.receive(state([{ ...anna, shape: 'star' }, bo], 'O'))
      expect(await screen.findByText('Kies een vorm om te beginnen.')).toBeVisible()
    })

    it('does not let you take the shape of the other, and says whose it is', async () => {
      const { socket } = await connected()
      socket.receive(state([{ ...anna, shape: 'star' }, bo], 'O'))
      const taken = await screen.findByRole('button', { name: 'ster, van Anna' })
      expect(taken).toBeDisabled()
    })

    it('asks for the shape this browser had last time when it joins, and remembers the one it has', async () => {
      setShape('fort')
      const { socket } = await connected()
      expect(socket.sent).toEqual([{ type: 'join', token: getToken(), shape: 'fort' }])

      socket.receive(state([{ ...anna, shape: 'oval' }]))
      await screen.findByText('Wachten op een tweede speler…')
      expect(getShape()).toBe('oval')
    })
  })

  describe('when something is wrong with the room', () => {
    it('says so, without opening a socket, when the room does not exist', async () => {
      const { sockets } = setup(false)
      expect(await screen.findByRole('alert')).toHaveTextContent('Deze kamer bestaat niet')
      expect(sockets).toHaveLength(0)
      expect(screen.getByRole('link', { name: 'Terug naar het begin' })).toHaveAttribute(
        'href',
        '/',
      )
      expect(screen.queryByRole('button', { name: 'Opnieuw proberen' })).not.toBeInTheDocument()
    })

    it('says so when the room turns out to be gone while connecting', async () => {
      const { socket } = await connected()
      socket.closeFromServer(4404)
      expect(await screen.findByRole('alert')).toHaveTextContent('Deze kamer bestaat niet')
    })

    it('says that the room is full, with no way to try again', async () => {
      const { socket } = await connected()
      socket.receive({ type: 'error', error: 'room-full' })
      socket.closeFromServer(4409)
      expect(await screen.findByRole('alert')).toHaveTextContent('Deze kamer zit vol')
      expect(screen.queryByRole('button', { name: 'Opnieuw proberen' })).not.toBeInTheDocument()
    })

    it('says so when the same player opens the room in another window, and offers to try again', async () => {
      const { socket } = await connected()
      socket.closeFromServer(4001)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Je speelt al in een ander venster',
      )
      expect(screen.getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
    })

    it('says so when the server cannot be reached, and tries again when asked', async () => {
      const { sockets, roomExists } = setup(new Error('offline'))
      expect(await screen.findByRole('alert')).toHaveTextContent('niet te bereiken')

      roomExists.mockImplementation(() => Promise.resolve(true))
      await userEvent.setup().click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
      await vi.waitFor(() => {
        expect(sockets).toHaveLength(1)
      })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('when the connection is lost', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    /** A room with two players and a game in it, on fake time, with the first socket open. */
    async function twoPlayersOnFakeTime() {
      vi.useFakeTimers()
      const world = setup()
      await act(() => vi.advanceTimersByTimeAsync(0))
      const socket = world.sockets[0]
      if (!socket) throw new Error('no socket yet')
      socket.open()
      socket.receive(
        state([
          { id: 'X', shape: 'cross', connected: true },
          { id: 'O', shape: 'circle', connected: true },
        ]),
      )
      return { ...world, socket }
    }

    const later = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

    it('says so, keeps the page as it was, and joins again by itself with a new socket', async () => {
      const { sockets, socket } = await twoPlayersOnFakeTime()
      socket.closeFromServer(1006)

      expect(screen.getByRole('alert')).toHaveTextContent('De verbinding is verbroken')
      expect(screen.getByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(sockets).toHaveLength(1)

      await later(500)
      expect(sockets).toHaveLength(2)
      expect(screen.getByRole('alert')).toHaveTextContent('Opnieuw verbinden…')

      sockets[1]?.open()
      expect(sockets[1]?.sent).toEqual([{ type: 'join', token: getToken() }])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('waits longer after every try that fails, and starts again from the short wait after a success', async () => {
      const { sockets, socket } = await twoPlayersOnFakeTime()
      socket.closeFromServer(1006)

      await later(500)
      expect(sockets).toHaveLength(2)
      sockets[1]?.closeFromServer(1006) // never opened: a second failure in a row
      await later(999)
      expect(sockets).toHaveLength(2)
      await later(1)
      expect(sockets).toHaveLength(3)

      sockets[2]?.open() // it worked: the next wait is the short one again
      sockets[2]?.closeFromServer(1006)
      await later(500)
      expect(sockets).toHaveLength(4)
    })

    it('keeps the game on screen when the server cannot be asked for the room while reconnecting', async () => {
      const { sockets, socket, roomExists } = await twoPlayersOnFakeTime()
      roomExists.mockImplementation(() => Promise.reject(new Error('offline')))
      socket.closeFromServer(1006)
      await later(500)

      expect(sockets).toHaveLength(1)
      expect(screen.getByRole('group', { name: 'Speelveld' })).toBeVisible()
      expect(screen.getByRole('alert')).toHaveTextContent('De verbinding is verbroken')

      roomExists.mockImplementation(() => Promise.resolve(true))
      await later(1000)
      expect(sockets).toHaveLength(2)
    })

    it('tries at once when the phone wakes up or the network is back', async () => {
      const { sockets, socket } = await twoPlayersOnFakeTime()
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      socket.closeFromServer(1006)

      await act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
        return Promise.resolve()
      })
      await later(0)
      expect(sockets).toHaveLength(2)

      sockets[1]?.closeFromServer(1006)
      await act(() => {
        window.dispatchEvent(new Event('online'))
        return Promise.resolve()
      })
      await later(0)
      expect(sockets).toHaveLength(3)
    })

    it('tries now when the button is pressed', async () => {
      const { sockets, socket } = await twoPlayersOnFakeTime()
      socket.closeFromServer(1006)
      act(() => {
        screen.getByRole('button', { name: 'Nu opnieuw verbinden' }).click()
      })
      await later(0)
      expect(sockets).toHaveLength(2)
    })

    it.each([4404, 4001])(
      'does not try again by itself when the room says goodbye with %i',
      async (code) => {
        const { sockets, socket } = await twoPlayersOnFakeTime()
        socket.closeFromServer(code)
        await later(60_000)
        expect(sockets).toHaveLength(1)
      },
    )

    it('says so when the socket was lost before the room said anything, and tries again', async () => {
      vi.useFakeTimers()
      const { sockets } = setup()
      await act(() => vi.advanceTimersByTimeAsync(0))
      const first = sockets[0]
      first?.open()
      first?.closeFromServer(1006)
      expect(screen.getByRole('alert')).toHaveTextContent('De verbinding is verbroken')
      await later(500)
      expect(sockets).toHaveLength(2)
    })
  })

  it('shows the game from its top when the lobby becomes the game, and then never moves the page', async () => {
    let scrollY = 0
    vi.spyOn(window, 'scrollTo').mockImplementation((_x: number, y: number) => {
      scrollY = y
    })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    const anna = { id: 'X', name: 'Anna', connected: true } as const
    const bo = { id: 'O', name: 'Bo', connected: true } as const
    const { socket } = await connected()
    socket.receive(state([anna, bo]))
    expect(await screen.findByRole('button', { name: 'kruis' })).toBeVisible()

    // Scrolled down to the shapes, the lobby turns into the game, which is shorter.
    scrollY = 700
    const players: StateMessage['players'] = [
      { ...anna, shape: 'cross' },
      { ...bo, shape: 'circle' },
    ]
    socket.receive(state(players))
    expect(await screen.findByRole('group', { name: 'Speelveld' })).toBeVisible()
    expect(scrollY).toBe(0)

    // A move of the other player is not a new view.
    scrollY = 120
    socket.receive({ ...state(players), moves: [{ player: 'cross', x: 0, y: 0 }] })
    expect(await screen.findByText('Bo is aan de beurt')).toBeVisible()
    expect(scrollY).toBe(120)
  })

  it('ignores a message that is not one of the server', async () => {
    const { socket } = await connected()
    socket.receive('not json')
    socket.receive(JSON.stringify({ type: 'surprise' }))
    expect(screen.getByRole('status')).toHaveTextContent('Verbinden met de kamer')
  })
})

describe.each([
  {
    language: 'en',
    connecting: 'Connecting to the room',
    waiting: 'Waiting for a second player…',
    code: 'Code B C D F',
    free: 'Seat 3: still free',
    field: /Field: 7 × 7, five in a row · 4 players/,
    others: 'Cas is still choosing a shape…',
    youAre: 'Anna (cross) – you',
    start: 'Start with 2 players',
    pick: 'Choose your shape',
    full: 'This room is full: all the seats are taken.',
    retry: 'Try again',
    gone: 'Circle is away for a moment… The game is waiting for them to come back.',
    youStart: 'You start',
    theirMove: "It is Circle's turn",
    won: 'You have won!',
    lost: 'Anna has won!',
    actions: ['Play again', 'Watch again', 'Leave'],
    leave: 'Leave',
    sure: 'Your seat in this room will be gone. Leave?',
    stay: 'Stay',
    leftNotice: 'Circle has left the game.',
    youLeft: 'You have left this game, so you cannot go back in.',
  },
  {
    language: 'fy',
    connecting: 'Ferbine mei de keamer',
    waiting: 'Wachtsje op in twadde spiler…',
    code: 'Koade B C D F',
    free: 'Plak 3: noch frij',
    field: /Fjild: 7 × 7, fiif op in rige · 4 spilers/,
    others: 'Cas kiest noch in foarm…',
    youAre: 'Anna (krús) – do',
    start: 'Start mei 2 spilers',
    pick: 'Kies dyn foarm',
    full: 'Dizze keamer sit fol: alle plakken binne beset.',
    retry: 'Opnij besykje',
    gone: 'Sirkel is efkes fuort… It spultsje wachtet op weromkomst.',
    youStart: 'Do begjinst',
    theirMove: 'Sirkel is oan de beurt',
    won: 'Do hast wûn!',
    lost: 'Anna hat wûn!',
    actions: ['Noch ien kear', 'Sjoch werom', 'Ophâlde'],
    leave: 'Ophâlde',
    sure: 'Dyn plak yn dizze keamer is dan fuort. Ophâlde?',
    stay: 'Bliuwe',
    leftNotice: 'Sirkel hat it spultsje ferlitten.',
    youLeft: 'Do hast dit spultsje ferlitten, dus do kinst der net mear yn werom.',
  },
] as const)('the room in $language', (text) => {
  const { language } = text
  const anna = { id: 'X', name: 'Anna', shape: 'cross', connected: true } as const
  const bo = { id: 'O', shape: 'circle', connected: true } as const
  const cas = { id: '3', name: 'Cas', connected: true } as const
  const field = { width: 7, height: 7, winLength: 5 }

  it('says it is connecting, then shows the lobby in the language', async () => {
    setLanguage(language)
    const { socket } = await connected()
    socket.receive(state([anna]))
    expect(await screen.findByText(text.waiting)).toBeVisible()
    expect(screen.getByLabelText(text.code)).toBeVisible()
    expect(screen.getByRole('group', { name: text.pick })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('shows the free seats, the field with the seats, who is still choosing and the start button', async () => {
    setLanguage(language)
    const { socket } = await connected()
    socket.receive(state([anna, bo, cas], 'X', field, 4))
    expect(await screen.findByText(text.free.replace('3', '4'))).toBeVisible()
    expect(screen.getByText(text.field)).toBeVisible()
    expect(screen.getByText(text.others)).toBeVisible()
    expect(screen.getByText(text.youAre)).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])

    socket.receive(state([anna, bo], 'X', field, 4))
    expect(await screen.findByRole('button', { name: text.start })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('says what is wrong with the room in the language, with a button that is in it too', async () => {
    setLanguage(language)
    const { socket } = await connected()
    socket.receive({ type: 'error', error: 'room-full' })
    expect(await screen.findByRole('alert')).toHaveTextContent(text.full)
    expect(dutchLeaks(language)).toEqual([])
  })

  it('offers trying again in the language when the join could not be read', async () => {
    setLanguage(language)
    const { socket } = await connected()
    socket.receive({ type: 'error', error: 'invalid-message' })
    expect(await screen.findByRole('button', { name: text.retry })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('says who won, to the winner and to the other, with the rematch and the replay', async () => {
    setLanguage(language)
    const { socket } = await connected()
    const moves = [
      { player: 'cross', x: 0, y: 0 },
      { player: 'circle', x: 0, y: 1 },
      { player: 'cross', x: 1, y: 0 },
      { player: 'circle', x: 1, y: 1 },
      { player: 'cross', x: 2, y: 0 },
    ]
    socket.receive({ ...state([anna, bo]), moves })
    expect(await screen.findByText(text.won)).toBeVisible()
    for (const name of text.actions) expect(screen.getByRole('button', { name })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])

    socket.receive({ ...state([anna, bo], 'O'), moves })
    expect(await screen.findByText(text.lost)).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('asks before leaving, tells the others who left, and says why you cannot come back', async () => {
    setLanguage(language)
    const { socket } = await connected()
    const moves = [
      { player: 'cross', x: 0, y: 0 },
      { player: 'circle', x: 0, y: 1 },
      { player: 'cross', x: 1, y: 0 },
      { player: 'circle', x: 1, y: 1 },
      { player: 'cross', x: 2, y: 0 },
    ]
    socket.receive({ ...state([anna, bo]), moves })
    await userEvent.click(await screen.findByRole('button', { name: text.leave }))
    expect(screen.getByRole('group', { name: text.sure })).toBeVisible()
    expect(screen.getByRole('button', { name: text.stay })).toHaveFocus()
    expect(dutchLeaks(language)).toEqual([])

    socket.receive({ ...state([anna, { ...bo, left: true }]), moves })
    expect(await screen.findByText(text.leftNotice)).toBeVisible()
    expect(screen.queryByRole('button', { name: text.actions[0] })).not.toBeInTheDocument()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('says in the language that you have left when you come back', async () => {
    setLanguage(language)
    const { socket } = await connected()
    socket.receive({ type: 'error', error: 'left' })
    expect(await screen.findByRole('alert')).toHaveTextContent(text.youLeft)
    expect(dutchLeaks(language)).toEqual([])
  })

  it('plays the online game in the language: who starts, whose turn it is, and who is away', async () => {
    setLanguage(language)
    const { socket } = await connected()
    const you = { ...anna }
    socket.receive(state([you, { ...bo, name: undefined }]))
    expect(await screen.findByText(text.youStart)).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])

    socket.receive({
      ...state([you, { ...bo, connected: false }]),
      moves: [{ player: 'cross', x: 0, y: 0 }],
    })
    expect(await screen.findByText(text.gone)).toBeVisible()
    expect(screen.getByText(text.theirMove)).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })
})
