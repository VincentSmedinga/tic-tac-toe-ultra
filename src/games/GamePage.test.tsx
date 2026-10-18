import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import type { StoredGame } from '../../shared/protocol.ts'
import type { RoomApi } from '../online/api.ts'
import type { GamesApi } from './api.ts'
import { GamePage } from './GamePage.tsx'

const GAME: StoredGame = {
  id: 'abcdefghijklmnop',
  finishedAt: Date.UTC(2026, 9, 18, 12, 30),
  config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
  moves: [
    { player: 'X', x: 0, y: 0 },
    { player: 'O', x: 0, y: 1 },
    { player: 'X', x: 1, y: 0 },
    { player: 'O', x: 1, y: 1 },
    { player: 'X', x: 2, y: 0 },
  ],
  players: [{ id: 'X', name: 'Anna' }, { id: 'O' }],
  result: { kind: 'won', winner: 'X' },
}

function apis(game: StoredGame | null = GAME) {
  const games: GamesApi = {
    listGames: vi.fn(() => Promise.resolve({ games: [] })),
    getGame: vi.fn(() => Promise.resolve(game)),
  }
  const rooms: RoomApi = {
    createRoom: vi.fn(() => Promise.resolve('BCDF')),
    roomExists: vi.fn(() => Promise.resolve(true)),
  }
  return { games, rooms }
}

beforeEach(() => {
  window.history.pushState(null, '', `/spel/${GAME.id}`)
})

describe('GamePage', () => {
  it('asks for the game by its id, and shows its replay with the names', async () => {
    const { games, rooms } = apis()
    render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
    expect(screen.getByRole('status')).toHaveTextContent('Spel ophalen')

    expect(await screen.findByRole('region', { name: 'Spel terugkijken' })).toBeVisible()
    expect(games.getGame).toHaveBeenCalledWith(GAME.id)
    expect(screen.getByRole('heading', { name: /Spel van .*2026/ })).toBeVisible()
    expect(screen.getByText('Zet 0 van 5')).toBeVisible()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Naar het einde' }))
    expect(screen.getByRole('status')).toHaveTextContent('Anna (kruis) heeft gewonnen!')
  })

  it('says so when there is no such game', async () => {
    const { games, rooms } = apis(null)
    render(<GamePage id="zzzzzzzzzzzzzzzz" api={games} rooms={rooms} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('bestaat niet')
    expect(screen.queryByRole('region', { name: 'Spel terugkijken' })).not.toBeInTheDocument()
  })

  it('says so when the game cannot be fetched, and tries again on request', async () => {
    const { games, rooms } = apis()
    vi.mocked(games.getGame).mockRejectedValueOnce(new Error('offline'))
    render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('niet op te halen')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
    expect(await screen.findByRole('region', { name: 'Spel terugkijken' })).toBeVisible()
  })

  it('gives the link to the game, to copy', async () => {
    const { games, rooms } = apis()
    render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
    expect(await screen.findByText(`${window.location.origin}/spel/${GAME.id}`)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Kopieer link' })).toBeVisible()
  })

  describe('playing again', () => {
    it('makes a new room and goes there', async () => {
      const { games, rooms } = apis()
      render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Speel opnieuw' }))
      expect(rooms.createRoom).toHaveBeenCalledOnce()
      expect(window.location.pathname).toBe('/kamer/BCDF')
    })

    it('makes it on the same field as the game that was played', async () => {
      const big: StoredGame = {
        ...GAME,
        config: { width: 7, height: 5, winLength: 5, players: ['cross', 'circle'] },
        moves: [],
      }
      const { games, rooms } = apis(big)
      render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Speel opnieuw' }))
      expect(rooms.createRoom).toHaveBeenCalledWith({ width: 7, height: 5, winLength: 5 })
    })

    it('says so when no room can be made, and stays', async () => {
      const { games, rooms } = apis()
      vi.mocked(rooms.createRoom).mockRejectedValueOnce(new Error('offline'))
      render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Speel opnieuw' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('kamer lukt nu niet')
      expect(window.location.pathname).toBe(`/spel/${GAME.id}`)
    })
  })
})

describe.each([
  {
    language: 'en',
    loading: 'Fetching the game…',
    title: /Game of .*2026/,
    replay: 'Watching a game again',
    won: 'Anna (cross) has won!',
    again: 'Play again',
    share: 'Show this game to someone else with this link:',
    copy: 'Copy link',
    missing: /does not exist/,
    failed: /cannot be fetched/,
  },
  {
    language: 'fy',
    loading: 'Spultsje ophelje…',
    title: /Spultsje fan .*2026/,
    replay: 'Spultsje werom sjen',
    won: 'Anna (krús) hat wûn!',
    again: 'Spylje opnij',
    share: 'Lit dit spultsje oan immen oars sjen mei dizze link:',
    copy: 'Kopiearje link',
    missing: /bestiet net/,
    failed: /net op te heljen/,
  },
] as const)('the page of a game in $language', (text) => {
  const { language } = text

  it('shows the replay, the buttons and the link in the language', async () => {
    setLanguage(language)
    const { games, rooms } = apis()
    render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
    expect(screen.getByRole('status')).toHaveTextContent(text.loading)
    expect(await screen.findByRole('region', { name: text.replay })).toBeVisible()
    expect(screen.getByRole('heading', { name: text.title })).toBeVisible()
    expect(screen.getByRole('button', { name: text.again })).toBeVisible()
    expect(screen.getByText(text.share)).toBeVisible()
    expect(screen.getByRole('button', { name: text.copy })).toBeVisible()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: language === 'en' ? 'To the end' : 'Nei it ein' }))
    expect(screen.getByRole('status')).toHaveTextContent(text.won)
    expect(dutchLeaks(language)).toEqual([])
  })

  it('says so when there is no such game, or it cannot be fetched', async () => {
    setLanguage(language)
    const { games, rooms } = apis(null)
    const { unmount } = render(<GamePage id="zzzzzzzzzzzzzzzz" api={games} rooms={rooms} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(text.missing)
    expect(dutchLeaks(language)).toEqual([])
    unmount()

    vi.mocked(games.getGame).mockRejectedValueOnce(new Error('offline'))
    render(<GamePage id={GAME.id} api={games} rooms={rooms} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(text.failed)
    expect(dutchLeaks(language)).toEqual([])
  })
})
