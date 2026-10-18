import { AppearanceControls } from '../appearance/AppearanceControls.tsx'
import { InstallHint } from '../pwa/InstallHint.tsx'
import { Link } from '../online/Link.tsx'
import type { Route } from '../online/route.ts'
import './SiteFooter.css'

/**
 * The bottom of every screen: the ways to move between the screens, and how the game looks. It has
 * a place of its own, after the screen and never over it, so nothing a screen needs is ever covered.
 * The link to the screen you are on is left out. Where the game can be put on a home screen, the
 * footer says how.
 */
export function SiteFooter({ route }: { route: Route }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-card">
        <nav className="footer-links" aria-label="Naar een ander scherm">
          {route.name !== 'start' && <Link to="/">Terug naar het begin</Link>}
          {route.name !== 'games' && <Link to="/spellen">Gespeelde spellen</Link>}
          {route.name !== 'stats' && <Link to="/statistieken">Statistieken</Link>}
        </nav>
        <InstallHint />
        <AppearanceControls />
      </div>
    </footer>
  )
}
