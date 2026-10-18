import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerMessage, StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { clearLastRoom, getLastRoom, getToken, setLastRoom, setName } from './identity.ts'
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

function state(players: StateMessage['players'], you = 'X'): StateMessage {
  const config = roomConfig(0)
  return {
    type: 'state',
    code: 'BCDF',
    you,
    round: 0,
    players,
    config: { ...config, players: [...config.players] },
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
      socket.receive(state([{ id: 'X', connected: true }]))
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
      socket.receive(state([{ id: 'X', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')
      socket.closeFromServer(1006)
      expect(getLastRoom()).toBe('BCDF')
    })
  })

  describe('while waiting for a second player', () => {
    it('shows the code and the link, and who is here', async () => {
      setName('Anna')
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', name: 'Anna', connected: true }]))

      expect(await screen.findByLabelText('Code B C D F')).toHaveTextContent('BCDF')
      expect(screen.getByText(`${window.location.origin}/kamer/BCDF`)).toBeVisible()
      expect(screen.getByText('Anna (kruis) – jij')).toBeVisible()
      expect(screen.getByText('Wachten op een tweede speler…')).toBeVisible()
    })

    it('shows a player without a name by their shape', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', connected: true }]))
      expect(await screen.findByText('Kruis – jij')).toBeVisible()
    })

    it('copies the link', async () => {
      const user = userEvent.setup()
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', connected: true }]))

      await user.click(await screen.findByRole('button', { name: 'Kopieer link' }))
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/kamer/BCDF`)
      expect(await screen.findByText('Link gekopieerd.')).toBeVisible()
    })

    it('says so when copying does not work', async () => {
      const user = userEvent.setup()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('no'))
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', connected: true }]))

      await user.click(await screen.findByRole('button', { name: 'Kopieer link' }))
      expect(await screen.findByText(/Kopiëren lukt niet/)).toBeVisible()
    })
  })

  describe('when the second player joins', () => {
    it('shows the board and who is who, as soon as the second player is there', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', name: 'Anna', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')

      socket.receive(
        state([
          { id: 'X', name: 'Anna', connected: true },
          { id: 'O', connected: true },
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
          { id: 'X', connected: true },
          { id: 'O', connected: false },
        ]),
      )
      expect(await screen.findByText(/Cirkel is even weg/)).toBeVisible()
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
          { id: 'X', connected: true },
          { id: 'O', connected: true },
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

  it('ignores a message that is not one of the server', async () => {
    const { socket } = await connected()
    socket.receive('not json')
    socket.receive(JSON.stringify({ type: 'surprise' }))
    expect(screen.getByRole('status')).toHaveTextContent('Verbinden met de kamer')
  })
})
