import { useEffect } from 'react'
import { applyLanguage } from './i18n/store.ts'
import { useLanguage } from './i18n/store.ts'
import { AppearanceSync } from './appearance/AppearanceSync.tsx'
import { MainNav } from './layout/MainNav.tsx'
import { SiteHeader } from './layout/SiteHeader.tsx'
import { SettingsPage } from './settings/SettingsPage.tsx'
import { GamePage } from './games/GamePage.tsx'
import { GamesPage } from './games/GamesPage.tsx'
import { StatsPage } from './stats/StatsPage.tsx'
import { Game } from './play/Game.tsx'
import { RoomPage } from './online/RoomPage.tsx'
import { useRoute } from './online/route.ts'
import { StartScreen } from './online/StartScreen.tsx'
import { Wallpaper } from './appearance/Wallpaper.tsx'

export function App() {
  const route = useRoute()
  const language = useLanguage()
  // The page's `lang`, direction and title say which language the screen is in (public/appearance.js
  // did it before the first paint).
  useEffect(() => {
    applyLanguage(language)
  }, [language])
  // On a phone a game has the screen to itself: no row of places, a way back in the header.
  const inGame = route.name === 'local' || route.name === 'room'
  return (
    <div className="app" data-screen={inGame ? 'game' : 'page'}>
      <AppearanceSync />
      <Wallpaper />
      <SiteHeader inGame={inGame} />
      <MainNav route={route} />
      <main>
        {route.name === 'start' && <StartScreen notice={route.notice} />}
        {route.name === 'local' && <Game />}
        {route.name === 'room' && <RoomPage key={route.code} code={route.code} />}
        {route.name === 'games' && <GamesPage />}
        {route.name === 'stats' && <StatsPage />}
        {route.name === 'settings' && <SettingsPage />}
        {route.name === 'game' && <GamePage key={route.id} id={route.id} />}
      </main>
    </div>
  )
}
