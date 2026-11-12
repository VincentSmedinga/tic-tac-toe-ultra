import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HouseServerMessage, HouseState } from '../../shared/house-protocol.ts'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import { getLastHouse, getName, getShape, getToken, setName, setShape } from '../online/identity.ts'
import { HousePage } from './HousePage.tsx'
import type { HouseDeps } from './useHouse.ts'

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
  open() {
    this.readyState = 1
    act(() => this.onopen?.())
  }
  receive(message: HouseServerMessage) {
    act(() => this.onmessage?.({ data: JSON.stringify(message) }))
  }
  closeFromServer(code: number) {
    this.readyState = 3
    act(() => this.onclose?.({ code }))
  }
}

function setup(exists = true) {
  const sockets: FakeSocket[] = []
  const deps: HouseDeps = {
    api: {
      createHouse: vi.fn(() => Promise.resolve('123456')),
      houseExists: vi.fn(() => Promise.resolve(exists)),
    },
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
  }
  render(<HousePage code="123456" deps={deps} />)
  return { sockets, deps }
}

const house = (members: HouseState['members'], you = 'a'): HouseState => ({
  type: 'state',
  code: '123456',
  you,
  members,
})

/** Says who you are, comes in, and lets the house answer. */
async function enter(name = 'Anna') {
  const user = userEvent.setup()
  const field = screen.getByLabelText(/Je naam|Your name|Dyn namme/)
  await user.clear(field)
  await user.type(field, `${name}{Enter}`)
  return user
}

async function connected(sockets: FakeSocket[]) {
  await vi.waitFor(() => {
    expect(sockets).toHaveLength(1)
  })
  const socket = sockets[0]
  if (!socket) throw new Error('no socket')
  socket.open()
  return socket
}

afterEach(() => {
  window.localStorage.clear()
})

describe('HousePage', () => {
  it('asks who you are first, with the name of last time filled in', () => {
    setName('Anna')
    const { sockets } = setup()
    expect(screen.getByRole('heading', { name: 'Wie ben je?' })).toBeVisible()
    expect(screen.getByLabelText('Je naam')).toHaveValue('Anna')
    expect(sockets).toHaveLength(0)
  })

  it('needs a name to come in', async () => {
    const { sockets } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Kom binnen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Vul je naam in')
    expect(screen.getByLabelText('Je naam')).toHaveAttribute('aria-invalid', 'true')
    expect(sockets).toHaveLength(0)
  })

  it('comes in with the name, the token and the shape of last time, and remembers the name', async () => {
    setShape('heart')
    const { sockets } = setup()
    await enter('  Bas ')
    const socket = await connected(sockets)
    expect(socket.sent).toEqual([{ type: 'join', token: getToken(), name: 'Bas', shape: 'heart' }])
    expect(getName()).toBe('Bas')
  })

  it('shows who is there, with a number for a name that came before, and what they do', async () => {
    const { sockets } = setup()
    await enter()
    const socket = await connected(sockets)
    socket.receive(
      house([
        { id: 'a', name: 'Anna', shape: 'heart', status: 'free' },
        { id: 'b', name: 'Anna', number: 2, status: 'free' },
      ]),
    )
    const people = within(screen.getByRole('region', { name: 'Wie er is' }))
    const items = people.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Anna – jij – vrij', 'Anna (2) – kiest nog – vrij'])
    expect(screen.getByLabelText('Code 1 2 3 4 5 6')).toHaveTextContent('123456')
    expect(screen.getByText(/\/huis\/123456$/)).toBeVisible()
    expect(getLastHouse()).toBe('123456')
  })

  it('says so when you are on your own', async () => {
    const { sockets } = setup()
    await enter()
    const socket = await connected(sockets)
    socket.receive(house([{ id: 'a', name: 'Anna', status: 'free' }]))
    expect(screen.getByText('Je bent nog alleen. Geef de code aan de anderen.')).toBeVisible()
  })

  it('chooses a shape, and the shapes of the others cannot be chosen', async () => {
    const { sockets } = setup()
    const user = await enter()
    const socket = await connected(sockets)
    socket.receive(
      house([
        { id: 'a', name: 'Anna', status: 'free' },
        { id: 'b', name: 'Bas', shape: 'star', status: 'free' },
      ]),
    )
    expect(screen.getByRole('button', { name: 'ster, van Bas' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'hart' }))
    expect(socket.sent.at(-1)).toEqual({ type: 'choose', shape: 'heart' })

    socket.receive({ type: 'error', error: 'shape-taken' })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Die vorm heeft iemand anders in het huis al',
    )
    socket.receive(house([{ id: 'a', name: 'Anna', shape: 'heart', status: 'free' }]))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getShape()).toBe('heart')
  })

  it('says so when the house does not exist', async () => {
    setup(false)
    await enter()
    expect(await screen.findByRole('alert')).toHaveTextContent('Dit huis bestaat niet (meer)')
  })

  it('says so when the house is full', async () => {
    const { sockets } = setup()
    await enter()
    const socket = await connected(sockets)
    socket.receive({ type: 'error', error: 'house-full' })
    socket.closeFromServer(4409)
    expect(screen.getByRole('alert')).toHaveTextContent('Dit huis is vol')
  })
})

describe.each([
  {
    language: 'en',
    title: 'Who are you?',
    enter: 'Come in',
    people: 'Who is here',
    rows: ['Anna – you – free', 'Bas – still choosing – free'],
  },
  {
    language: 'fy',
    title: 'Wa bisto?',
    enter: 'Kom deryn',
    people: 'Wa’t der is',
    rows: ['Anna – do – frij', 'Bas – kiest noch – frij'],
  },
] as const)('the house in $language', ({ language, title, enter: button, people, rows }) => {
  it('says everything in the language', async () => {
    setLanguage(language)
    setName('Anna')
    const { sockets } = setup()
    expect(screen.getByRole('heading', { name: title })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
    await userEvent.setup().click(screen.getByRole('button', { name: button }))
    const socket = await connected(sockets)
    socket.receive(
      house([
        { id: 'a', name: 'Anna', shape: 'heart', status: 'free' },
        { id: 'b', name: 'Bas', status: 'free' },
      ]),
    )
    const list = within(screen.getByRole('region', { name: people }))
    expect(list.getAllByRole('listitem').map((item) => item.textContent)).toEqual(rows)
    expect(dutchLeaks(language)).toEqual([])
  })
})
