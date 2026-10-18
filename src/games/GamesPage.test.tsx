import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSummary, GamesPage as Page } from '../../shared/protocol.ts'
import { getToken } from '../online/identity.ts'
import type { GamesApi } from './api.ts'
import { GamesPage } from './GamesPage.tsx'

const idOf = (n: number) => n.toString().padStart(16, 'g')

function summary(n: number, overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    id: idOf(n),
    finishedAt: Date.UTC(2026, 9, 18, 12, n),
    players: [{ id: 'X', name: 'Anna' }, { id: 'O' }],
    result: { kind: 'won', winner: 'X' },
    width: 3,
    height: 3,
    moves: 5,
    ...overrides,
  }
}

function fakeApi(pages: Page[]): GamesApi & { listGames: ReturnType<typeof vi.fn> } {
  const listGames = vi.fn((_token: string, before?: string) => {
    const index = before === undefined ? 0 : Number(before)
    return Promise.resolve(pages[index] ?? { games: [] })
  })
  return { listGames, getGame: vi.fn(() => Promise.resolve(null)) }
}

beforeEach(() => {
  window.history.pushState(null, '', '/spellen')
})

afterEach(() => {
  window.localStorage.clear()
})

describe('GamesPage', () => {
  it('asks for the games of this browser', async () => {
    const api = fakeApi([{ games: [] }])
    render(<GamesPage api={api} />)
    expect(screen.getByRole('status')).toHaveTextContent('Spellen ophalen')
    await screen.findByText(/nog geen spel online gespeeld/)
    expect(api.listGames).toHaveBeenCalledWith(getToken())
  })

  it('says so when there are none, and that a game on one screen is not kept', async () => {
    render(<GamesPage api={fakeApi([{ games: [] }])} />)
    expect(await screen.findByText(/nog geen spel online gespeeld/)).toBeVisible()
    expect(screen.getByText(/niet bewaard/)).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists the games with when, who and how it ended, each a link to the game', async () => {
    const games = [
      summary(2),
      summary(1, { result: { kind: 'draw' }, players: [{ id: 'X' }, { id: 'O', name: 'Bo' }] }),
    ]
    render(<GamesPage api={fakeApi([{ games }])} />)
    const items = await screen.findAllByRole('listitem')
    const [firstItem, secondItem] = items
    if (!firstItem || !secondItem) throw new Error('expected two games')

    const first = within(firstItem).getByRole('link')
    expect(first).toHaveAttribute('href', `/spel/${idOf(2)}`)
    expect(first).toHaveTextContent('Anna (kruis)')
    expect(first).toHaveTextContent('Cirkel')
    expect(first).toHaveTextContent('Anna (kruis) heeft gewonnen')
    expect(first).toHaveTextContent(/2026/)

    const second = within(secondItem).getByRole('link')
    expect(second).toHaveTextContent('Bo (cirkel)')
    expect(second).toHaveTextContent('Gelijkspel')
  })

  it('shows the shapes the players chose, also in games kept before shapes could be chosen', async () => {
    const chosen = summary(2, {
      players: [{ id: 'star', name: 'Anna' }, { id: 'heart' }],
      result: { kind: 'won', winner: 'heart' },
    })
    render(<GamesPage api={fakeApi([{ games: [chosen, summary(1)] }])} />)
    const [first, second] = await screen.findAllByRole('link', { name: /2026/ })
    expect(first).toHaveTextContent('Anna (ster)')
    expect(first).toHaveTextContent('Hart heeft gewonnen')
    expect(second).toHaveTextContent('Anna (kruis)')
  })

  it('names the size of a field that is not the classic one', async () => {
    render(<GamesPage api={fakeApi([{ games: [summary(1, { width: 12, height: 10 })] }])} />)
    expect(await screen.findByText(/veld van 12 bij 10/)).toBeVisible()
  })

  it('shows more games when asked, after the ones that are there', async () => {
    const api = fakeApi([{ games: [summary(2)], next: '1' }, { games: [summary(1)] }])
    render(<GamesPage api={api} />)
    await screen.findByRole('list')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Meer spellen' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(api.listGames).toHaveBeenLastCalledWith(getToken(), '1')
    expect(screen.queryByRole('button', { name: 'Meer spellen' })).not.toBeInTheDocument()
  })

  it('has no button for more when everything is shown', async () => {
    render(<GamesPage api={fakeApi([{ games: [summary(1)] }])} />)
    await screen.findByRole('list')
    expect(screen.queryByRole('button', { name: 'Meer spellen' })).not.toBeInTheDocument()
  })

  it('keeps what is shown when the next page fails, and lets it be asked again', async () => {
    const api = fakeApi([{ games: [summary(2)], next: '1' }, { games: [summary(1)] }])
    render(<GamesPage api={api} />)
    await screen.findByRole('list')
    api.listGames.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Meer spellen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('volgende spellen')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Meer spellen' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the games cannot be fetched, and tries again on request', async () => {
    const api = fakeApi([{ games: [summary(1)] }])
    api.listGames.mockRejectedValueOnce(new Error('offline'))
    render(<GamesPage api={api} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('niet op te halen')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
    expect(await screen.findByRole('list')).toBeVisible()
  })

  it('leads back to the start', async () => {
    render(<GamesPage api={fakeApi([{ games: [] }])} />)
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Terug naar het begin' }))
    expect(window.location.pathname).toBe('/')
  })
})
