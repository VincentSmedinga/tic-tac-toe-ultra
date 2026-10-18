import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomApi } from './api.ts'
import { setName } from './identity.ts'
import { StartScreen } from './StartScreen.tsx'

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
  it('offers a new room, joining with a code, and the game on one screen', () => {
    render(<StartScreen api={fakeApi()} />)
    expect(screen.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
    expect(screen.getByLabelText('Meedoen met een code')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Meedoen' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Samen op één scherm' })).toHaveAttribute(
      'href',
      '/samen',
    )
  })

  it('starts with the name that was typed last time', () => {
    setName('Anna')
    render(<StartScreen api={fakeApi()} />)
    expect(screen.getByLabelText('Je naam (hoeft niet)')).toHaveValue('Anna')
  })

  it('says so when the address of a room was no code', () => {
    render(<StartScreen notice="bad-code" api={fakeApi()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Dat is geen geldige code')
  })

  describe('a new room', () => {
    it('makes a room, remembers the name, and goes to the room', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Je naam (hoeft niet)'), '  Anna ')
      await user.click(screen.getByRole('button', { name: 'Nieuwe kamer' }))

      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/kamer/BCDF')
      })
      expect(api.createRoom).toHaveBeenCalledOnce()
      expect(window.localStorage.getItem('tic-tac-toe-ultra.name')).toBe('Anna')
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
      const field = screen.getByLabelText('Meedoen met een code')
      await user.type(field, 'bc1a d')
      expect(field).toHaveValue('BCD')
      await user.type(field, 'fghj')
      expect(field).toHaveValue('BCDF')
    })

    it('asks for four letters when the code is too short, without asking the server', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Meedoen met een code'), 'bcd')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Een code heeft 4 letters')
      expect(api.roomExists).not.toHaveBeenCalled()
    })

    it('says so when there is no such room', async () => {
      const api = fakeApi({ roomExists: vi.fn(() => Promise.resolve(false)) })
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Meedoen met een code'), 'bcdf')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Die kamer bestaat niet')
      expect(window.location.pathname).toBe('/')
    })

    it('goes to the room when it exists, also on Enter', async () => {
      const api = fakeApi()
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Meedoen met een code'), 'bcdf{Enter}')

      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/kamer/BCDF')
      })
      expect(api.roomExists).toHaveBeenCalledWith('BCDF')
    })

    it('says so when the server cannot be reached', async () => {
      const api = fakeApi({ roomExists: vi.fn(() => Promise.reject(new Error('down'))) })
      const user = userEvent.setup()
      render(<StartScreen api={api} />)
      await user.type(screen.getByLabelText('Meedoen met een code'), 'bcdf')
      await user.click(screen.getByRole('button', { name: 'Meedoen' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Het zoeken naar de kamer lukt nu niet',
      )
    })
  })
})
