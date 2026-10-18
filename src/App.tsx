import { Game } from './play/Game.tsx'
import { Link } from './online/Link.tsx'
import { RoomPage } from './online/RoomPage.tsx'
import { useRoute } from './online/route.ts'
import { StartScreen } from './online/StartScreen.tsx'

export function App() {
  const route = useRoute()
  return (
    <main>
      <h1>Boter, kaas en eieren</h1>
      {route.name === 'start' && <StartScreen notice={route.notice} />}
      {route.name === 'local' && (
        <>
          <Game />
          <p>
            <Link to="/">Terug naar het begin</Link>
          </p>
        </>
      )}
      {route.name === 'room' && <RoomPage key={route.code} code={route.code} />}
    </main>
  )
}
