import { expect, test } from '@playwright/test'
import { replayGame } from '../shared/game/index.ts'
import { parseServerMessage, storedGameSchema } from '../shared/protocol.ts'
import type { StateMessage } from '../shared/protocol.ts'

/** A player without a browser: a socket on the real room, which keeps the last state it got. */
async function connect(baseURL: string, code: string, token: string, name: string, shape: string) {
  const socket = new WebSocket(`${baseURL.replace('http', 'ws')}/api/rooms/${code}/ws`)
  let last: StateMessage | undefined
  socket.addEventListener('message', (event) => {
    const message = parseServerMessage(event.data)
    if (message?.type === 'state') last = message
  })
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve()
    })
    socket.addEventListener('error', () => {
      reject(new Error('the socket did not open'))
    })
  })
  socket.send(JSON.stringify({ type: 'join', token, name, shape }))
  return {
    socket,
    state: () => last,
    move(x: number, y: number) {
      socket.send(JSON.stringify({ type: 'move', x, y }))
    },
  }
}

test('a finished game is kept, outlives its players and can be replayed', async ({
  request,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('no baseURL')
  const created = await request.post('/api/rooms')
  const { code } = (await created.json()) as { code: string }

  const anna = await connect(baseURL, code, 'a'.repeat(24), 'Anna', 'cross')
  const bo = await connect(baseURL, code, 'b'.repeat(24), 'Bo', 'circle')
  await expect.poll(() => bo.state()?.players.length).toBe(2)

  // Anna wins on the top row; she is the first to join, has the cross and starts.
  const turns: [typeof anna, number, number][] = [
    [anna, 0, 0],
    [bo, 0, 1],
    [anna, 1, 0],
    [bo, 1, 1],
  ]
  for (const [player, x, y] of turns) {
    const before = player.state()?.moves.length ?? 0
    player.move(x, y)
    await expect.poll(() => player.state()?.moves.length).toBe(before + 1)
  }
  expect(anna.state()?.gameId).toBeUndefined()
  anna.move(2, 0)
  await expect.poll(() => anna.state()?.gameId).toBeDefined()
  await expect.poll(() => bo.state()?.gameId).toBe(anna.state()?.gameId)
  const id = anna.state()?.gameId ?? ''

  // Everybody leaves; the game stays and is there for anyone with the id.
  anna.socket.close()
  bo.socket.close()
  const response = await request.get(`/api/games/${id}`)
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text).not.toContain('a'.repeat(24))
  expect(text).not.toContain('b'.repeat(24))

  const game = storedGameSchema.parse(JSON.parse(text))
  expect(game).toMatchObject({
    id,
    players: [
      { id: 'cross', name: 'Anna' },
      { id: 'circle', name: 'Bo' },
    ],
    result: { kind: 'won', winner: 'cross' },
  })
  expect(game.finishedAt).toBeGreaterThan(Date.now() - 60_000)
  const replayed = replayGame(game.config, game.moves)
  expect(replayed.ok && replayed.state.status.kind).toBe('won')

  expect((await request.get('/api/games/zzzzzzzzzzzzzzzz')).status()).toBe(404)
})
