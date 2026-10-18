import { GamePage } from './games/GamePage.tsx'
import { GamesPage } from './games/GamesPage.tsx'
import { Game } from './play/Game.tsx'
import { Link } from './online/Link.tsx'
import { RoomPage } from './online/RoomPage.tsx'
import { useRoute } from './online/route.ts'
import { StartScreen } from './online/StartScreen.tsx'
import { StijlKiezer } from './style/StijlKiezer.tsx'
import { Wallpaper } from './style/Wallpaper.tsx'
import { Wordmark } from './style/Wordmark.tsx'

export function App() {
  const route = useRoute()
  return (
    <main>
      <Wallpaper />
      <Wordmark />
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
      {route.name === 'games' && <GamesPage />}
      {route.name === 'game' && <GamePage key={route.id} id={route.id} />}
      <StijlKiezer />
    </main>
  )
}
