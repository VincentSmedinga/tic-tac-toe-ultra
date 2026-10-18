import { useEffect } from 'react'
import { applyLanguage } from './i18n/store.ts'
import { useLanguage } from './i18n/store.ts'
import { SiteFooter } from './layout/SiteFooter.tsx'
import { GamePage } from './games/GamePage.tsx'
import { GamesPage } from './games/GamesPage.tsx'
import { StatsPage } from './stats/StatsPage.tsx'
import { Game } from './play/Game.tsx'
import { RoomPage } from './online/RoomPage.tsx'
import { useRoute } from './online/route.ts'
import { StartScreen } from './online/StartScreen.tsx'
import { Wallpaper } from './appearance/Wallpaper.tsx'
import { Wordmark } from './appearance/Wordmark.tsx'

export function App() {
  const route = useRoute()
  const language = useLanguage()
  // The page's `lang`, direction and title say which language the screen is in (public/appearance.js
  // did it before the first paint).
  useEffect(() => {
    applyLanguage(language)
  }, [language])
  return (
    <div className="app">
      <Wallpaper />
      <header>
        <Wordmark />
      </header>
      <main>
        {route.name === 'start' && <StartScreen notice={route.notice} />}
        {route.name === 'local' && <Game />}
        {route.name === 'room' && <RoomPage key={route.code} code={route.code} />}
        {route.name === 'games' && <GamesPage />}
        {route.name === 'stats' && <StatsPage />}
        {route.name === 'game' && <GamePage key={route.id} id={route.id} />}
      </main>
      <SiteFooter route={route} />
    </div>
  )
}
