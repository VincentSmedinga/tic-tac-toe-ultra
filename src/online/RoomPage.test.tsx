import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerMessage, StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { getToken, setName } from './identity.ts'
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
    it('says that you are both here, and who is who', async () => {
      const { socket } = await connected()
      socket.receive(state([{ id: 'X', name: 'Anna', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')

      socket.receive(
        state([
          { id: 'X', name: 'Anna', connected: true },
          { id: 'O', connected: true },
        ]),
      )
      expect(await screen.findByRole('heading', { name: 'Jullie zijn er allebei!' })).toBeVisible()
      expect(screen.getByText('Anna (kruis) – jij')).toBeVisible()
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
      expect(await screen.findByText('Cirkel – niet verbonden')).toBeVisible()
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
    it('says so, and joins again with a new socket when asked, keeping what was on screen', async () => {
      const { sockets, socket } = await connected()
      socket.receive(state([{ id: 'X', connected: true }]))
      await screen.findByText('Wachten op een tweede speler…')

      socket.closeFromServer(1006)
      expect(await screen.findByRole('alert')).toHaveTextContent('De verbinding is verbroken')
      expect(screen.getByLabelText('Code B C D F')).toBeVisible()

      await userEvent.setup().click(screen.getByRole('button', { name: 'Opnieuw verbinden' }))
      const second = await vi.waitFor(() => {
        const next = sockets[1]
        if (!next) throw new Error('no second socket yet')
        return next
      })
      second.open()
      expect(second.sent).toEqual([{ type: 'join', token: getToken() }])
      expect(screen.queryByText('De verbinding is verbroken.')).not.toBeInTheDocument()
    })

    it('says so when the socket was lost before the room said anything', async () => {
      const { socket } = await connected()
      socket.closeFromServer(1006)
      expect(await screen.findByRole('alert')).toHaveTextContent('De verbinding is verbroken')
    })
  })

  it('ignores a message that is not one of the server', async () => {
    const { socket } = await connected()
    socket.receive('not json')
    socket.receive(JSON.stringify({ type: 'surprise' }))
    expect(screen.getByRole('status')).toHaveTextContent('Verbinden met de kamer')
  })
})
