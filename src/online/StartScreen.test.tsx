import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import type { RoomApi } from './api.ts'
import { getLastRoom, getRoomChoice, setLastRoom, setName } from './identity.ts'
import { StartScreen } from './StartScreen.tsx'

/** The players and the field are behind the line that says what the room is made with. */
async function openOptions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Aanpassen|Change|Oanpasse/ }))
}

function fakeApi(overrides: Partial<RoomApi> = {}): RoomApi {
  return {
    createRoom: vi.fn(() => Promise.resolve('BCDF')),
    roomExists: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  }
}

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(() => {
  window.localStorage.clear()
})

describe('StartScreen', () => {
  describe('a room this browser is still in', () => {
    it('offers the way back to it, first of all', async () => {
      setLastRoom('BCDF')
      render(<StartScreen api={fakeApi()} />)
      const card = await screen.findByRole('region', { name: 'Je speelt nog mee' })
      const link = within(card).getByRole('link', { name: 'Terug naar kamer BCDF' })
      expect(link).toHaveAttribute('href', '/kamer/BCDF')
    })

    it('goes back to the room when it is followed', async () => {
      setLastRoom('BCDF')
      render(<StartScreen api={fakeApi()} />)
      await userEvent
        .setup()
        .click(await screen.findByRole('link', { name: 'Terug naar kamer BCDF' }))
      expect(window.location.pathname).toBe('/kamer/BCDF')
    })

    it('offers nothing when there is no room to go back to', () => {
      render(<StartScreen api={fakeApi()} />)
      expect(screen.queryByRole('region', { name: 'Je speelt nog mee' })).not.toBeInTheDocument()
    })

    it('offers nothing, and forgets the room, when it no longer exists', async () => {
      setLastRoom('BCDF')
      const api = fakeApi({ roomExists: vi.fn(() => Promise.resolve(false)) })
      render(<StartScreen api={api} />)
      await vi.waitFor(() => {
        expect(getLastRoom()).toBeNull()
      })
      expect(screen.queryByRole('region', { name: 'Je speelt nog mee' })).not.toBeInTheDocument()
    })

    it('offers nothing, but keeps the room, when the server cannot be asked', async () => {
      setLastRoom('BCDF')
      const roomExists = vi.fn(() => Promise.reject(new Error('offline')))
      render(<StartScreen api={fakeApi({ roomExists })} />)
      await vi.waitFor(() => {
        expect(roomExists).toHaveBeenCalledWith('BCDF')
      })
      expect(screen.queryByRole('region', { name: 'Je speelt nog mee' })).not.toBeInTheDocument()
      expect(getLastRoom()).toBe('BCDF')
    })
  })

  it('shows one main action, with the way to join and the way to play on one screen', () => {
    render(<StartScreen api={fakeApi()} />)
    const create = within(screen.getByRole('region', { name: 'Een nieuwe kamer starten' }))
    expect(create.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
    const join = within(screen.getByRole('region', { name: 'Meedoen met een code' }))
    expect(join.getByRole('button', { name: 'Meedoen' })).toBeVisible()
    expect(screen.getByLabelText('Code van de kamer')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Samen op één scherm' })).toHaveAttribute(
      'href',
      '/samen',
    )
  })

  it('has no name field: the name is on the settings page, and a line says whose it is', () => {
    setName('Anna')
    render(<StartScreen api={fakeApi()} />)
    expect(screen.queryByLabelText('Je naam (hoeft niet)')).not.toBeInTheDocument()
    expect(screen.getByText(/Je speelt als Anna\./)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Wijzig je naam' })).toHaveAttribute(
      'href',
      '/instellingen',
    )
  })

  it('asks for the name on the settings page while there is none', () => {
    render(<StartScreen api={fakeApi()} />)
    expect(screen.getByRole('link', { name: 'Voeg je naam toe' })).toHaveAttribute(
      'href',
      '/instellingen',
    )
  })

  it('says so when the address of a room was no code', () => {
    render(<StartScreen notice="bad-code" api={fakeApi()} />)
    expect(
      within(screen.getByRole('region', { name: 'Meedoen met een code' })).getByRole('alert'),
    ).toHaveTextContent('Dat is geen geldige code')
  })

  describe('a new room', () => {
    it('makes a room and goes to the room', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))

      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/kamer/BCDF')
      })
      expect(api.createRoom).toHaveBeenCalledOnce()
    })

    it('says what the room is made with, and keeps the players and the field behind Aanpassen', async () => {
      render(<StartScreen api={fakeApi()} />)
      const adjust = screen.getByRole('button', {
        name: /2 spelers · 3 × 3, drie op een rij · Aanpassen/,
      })
      expect(adjust).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('group', { name: 'Veld' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Aantal spelers')).not.toBeInTheDocument()

      await userEvent.setup().click(adjust)
      expect(adjust).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('group', { name: 'Veld' })).toBeVisible()
      expect(screen.getByLabelText('Aantal spelers')).toBeVisible()
    })

    it('makes the next room with what the last one was made with', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<StartScreen api={fakeApi()} />)
      await openOptions(user)
      await user.click(screen.getByRole('button', { name: /Groter/ }))
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '4')
      expect(getRoomChoice()).toEqual({
        players: 4,
        field: { width: 7, height: 7, winLength: 5 },
      })
      unmount()

      const api = fakeApi()
      render(<StartScreen api={api} />)
      expect(
        screen.getByRole('button', { name: /4 spelers · 7 × 7, vijf op een rij · Aanpassen/ }),
      ).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))
      expect(api.createRoom).toHaveBeenCalledWith({ width: 7, height: 7, winLength: 5, players: 4 })
    })

    it('starts classic again when what was kept is no good', () => {
      window.localStorage.setItem('tic-tac-toe-ultra.new-room', '{"players":99,"field":{}}')
      render(<StartScreen api={fakeApi()} />)
      expect(getRoomChoice()).toBeNull()
      expect(screen.getByRole('button', { name: /2 spelers · 3 × 3/ })).toBeVisible()
    })

    it('is a classic room unless another field is chosen', async () => {
      const api = fakeApi()
      render(<StartScreen api={api} />)
      await userEvent.setup().click(screen.getByRole('button', { name: 'Nieuwe kamer' }))
      expect(api.createRoom).toHaveBeenCalledWith({ width: 3, height: 3, winLength: 3, players: 2 })
    })

    it('has the field to choose in the card of the new room, and makes the room with it', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await openOptions(user)
      const card = within(screen.getByRole('region', { name: 'Een nieuwe kamer starten' }))
      expect(card.getByRole('group', { name: 'Veld' })).toBeVisible()

      await user.click(card.getByRole('button', { name: /Groter/ }))
      await user.click(card.getByRole('button', { name: 'Nieuwe kamer' }))
      expect(api.createRoom).toHaveBeenCalledWith({ width: 7, height: 7, winLength: 5, players: 2 })
    })

    it('makes a room for as many people as are chosen, two being what it is', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await openOptions(user)
      expect(screen.getByLabelText('Aantal spelers')).toHaveValue('2')
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '5')
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))
      expect(api.createRoom).toHaveBeenCalledWith({
        width: 3,
        height: 3,
        winLength: 3,
        players: 5,
      })
    })

    it('offers two to twelve players', async () => {
      render(<StartScreen api={fakeApi()} />)
      await openOptions(userEvent.setup())
      const options = [...screen.getByLabelText('Aantal spelers').querySelectorAll('option')]
      expect(options.map((option) => option.value)).toEqual([
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
      ])
    })

    it('says that a bigger field is nicer with more than two players, while the field is classic', async () => {
      render(<StartScreen api={fakeApi()} />)
      const user = userEvent.setup()
      await openOptions(user)
      expect(screen.queryByText(/groter veld leuker/)).not.toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '4')
      expect(screen.getByText('Met meer dan twee spelers is een groter veld leuker.')).toBeVisible()
      await user.click(screen.getByRole('button', { name: /Groter/ }))
      expect(screen.queryByText(/groter veld leuker/)).not.toBeInTheDocument()
    })

    it('makes a room on a field of your own', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await openOptions(user)
      await user.click(screen.getByRole('button', { name: /Eigen veld/ }))
      await user.selectOptions(screen.getByLabelText('Breedte'), '11')
      await user.selectOptions(screen.getByLabelText('Hoogte'), '9')
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))
      expect(api.createRoom).toHaveBeenCalledWith({
        width: 11,
        height: 9,
        winLength: 5,
        players: 2,
      })
    })

    it('says so when it does not work, and stays on the start screen', async () => {
      const api = fakeApi({ createRoom: vi.fn(() => Promise.reject(new Error('down'))) })
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Het maken van een kamer lukt nu niet',
      )
      expect(window.location.pathname).toBe('/')
      expect(screen.getByRole('button', { name: 'Nieuwe kamer' })).toBeEnabled()
    })
  })

  describe('joining with a code', () => {
    it('makes capitals of what is typed and leaves out what is no letter of a code', async () => {
      const user = userEvent.setup()
      render(<StartScreen api={fakeApi()} />)
      const field = screen.getByLabelText('Code van de kamer')
      await user.type(field, 'bc1a d')
      expect(field).toHaveValue('BCD')
      await user.type(field, 'fghj')
      expect(field).toHaveValue('BCDF')
    })

    it('asks for four letters when the code is too short, without asking the server', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Code van de kamer'), 'bcd')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Een code heeft 4 letters')
      expect(api.roomExists).not.toHaveBeenCalled()
    })

    it('says so when there is no such room', async () => {
      const api = fakeApi({ roomExists: vi.fn(() => Promise.resolve(false)) })
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Code van de kamer'), 'bcdf')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Die kamer bestaat niet')
      expect(window.location.pathname).toBe('/')
    })

    it('goes to the room when it exists, also on Enter', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Code van de kamer'), 'bcdf{Enter}')

      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/kamer/BCDF')
      })
      expect(api.roomExists).toHaveBeenCalledWith('BCDF')
    })

    it('says so when the server cannot be reached', async () => {
      const api = fakeApi({ roomExists: vi.fn(() => Promise.reject(new Error('down'))) })
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Code van de kamer'), 'bcdf')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Het zoeken naar de kamer lukt nu niet',
      )
    })
  })
})

describe.each([
  {
    language: 'en',
    heading: 'Start a new room',
    create: 'New room',
    join: 'Join',
    local: 'Together on one screen',
    code: 'That is not a valid code. Ask the person who made the room for the code again.',
    resume: 'Back to room BCDF',
  },
  {
    language: 'fy',
    heading: 'In nije keamer starte',
    create: 'Nije keamer',
    join: 'Meidwaan',
    local: 'Tegearre op ien skerm',
    code: 'Dat is gjin jildige koade. Freegje de koade opnij oan wa’t de keamer makke hat.',
    resume: 'Werom nei keamer BCDF',
  },
] as const)(
  'the start screen in $language',
  ({ language, heading, create, join, local, code, resume }) => {
    it('says everything in the language, also what went wrong and the way back to a room', async () => {
      setLanguage(language)
      setLastRoom('BCDF')
      render(<StartScreen notice="bad-code" api={fakeApi()} />)
      expect(await screen.findByRole('link', { name: resume })).toBeVisible()
      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      expect(screen.getByRole('button', { name: create })).toBeVisible()
      expect(screen.getByRole('button', { name: join })).toBeVisible()
      expect(screen.getByRole('link', { name: local })).toBeVisible()
      expect(screen.getByRole('alert')).toHaveTextContent(code)
      expect(dutchLeaks(language)).toEqual([])
    })

    it('says why a code is no good, in the language', async () => {
      setLanguage(language)
      render(<StartScreen api={fakeApi()} />)
      await userEvent.setup().click(screen.getByRole('button', { name: join }))
      expect(screen.getByRole('alert')).toHaveTextContent(
        language === 'en'
          ? 'A code has 4 letters, without vowels.'
          : 'In koade hat 4 letters, sûnder klinkers.',
      )
      expect(dutchLeaks(language)).toEqual([])
    })
  },
)
