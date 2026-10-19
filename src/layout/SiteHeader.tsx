import { Wordmark } from '../appearance/Wordmark.tsx'
import { useText } from '../i18n/store.ts'
import { Link } from '../online/Link.tsx'
import './SiteHeader.css'

/**
 * The top of every screen: the name of the game. On a phone, while a game is on the screen, the
 * title gives way to a way back to the start and the board has the room (the CSS keys on
 * `data-screen="game"` of `.app`); everywhere else the way to the start is the first tab.
 */
export function SiteHeader({ inGame }: { inGame: boolean }) {
  const t = useText()
  return (
    <header className="site-header">
      {inGame && (
        <Link to="/" className="back-link">
          <span aria-hidden="true">‹</span> {t('nav.back')}
        </Link>
      )}
      <Wordmark />
    </header>
  )
}
