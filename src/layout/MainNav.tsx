import type { ReactNode } from 'react'
import { useText } from '../i18n/store.ts'
import type { PlainKey } from '../i18n/types.ts'
import { Link } from '../online/Link.tsx'
import type { Route } from '../online/route.ts'
import { placeOf } from './place.ts'
import type { Place } from './place.ts'
import './MainNav.css'

/** The pictures are drawn with a line, in the colour of the text, like the rest of the game. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const PLACES: readonly { place: Place; to: string; label: PlainKey; icon: ReactNode }[] = [
  {
    place: 'start',
    to: '/',
    label: 'nav.home',
    icon: <path d="M3.5 11 12 3.5l8.5 7.5v9.5H15v-6H9v6H3.5z" />,
  },
  {
    place: 'games',
    to: '/spellen',
    label: 'nav.games',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5.2l3.2 2" />
      </>
    ),
  },
  {
    place: 'stats',
    to: '/statistieken',
    label: 'nav.stats',
    icon: <path d="M5 20v-9M12 20V4M19 20v-6.5" />,
  },
  {
    place: 'settings',
    to: '/instellingen',
    label: 'nav.settings',
    icon: (
      <>
        <path d="M4 7h9M18 7h2M4 17h2M11 17h9" />
        <circle cx="15.5" cy="7" r="2.4" />
        <circle cx="8.5" cy="17" r="2.4" />
      </>
    ),
  },
]

/**
 * The four places of the game: the start, the games played, the statistics and the settings. On a
 * phone they are a bar of tabs at the end of the page, where a thumb is, and not over it (nothing of
 * the page is fixed to the screen's edges, see docs/architecture/appearance.md); from 48 rem wide
 * they are a row under the title. While a game is on a phone's screen the bar is left out and the
 * header has a way back instead (`SiteHeader`). It comes right after the header in the page, so the
 * keyboard reaches it first, and `order` moves it down on a phone.
 */
export function MainNav({ route }: { route: Route }) {
  const t = useText()
  const here = placeOf(route)
  return (
    <nav className="main-nav" aria-label={t('nav.label')}>
      <ul>
        {PLACES.map(({ place, to, label, icon }) => (
          <li key={place}>
            <Link to={to} className="main-nav-link" current={place === here}>
              <Icon>{icon}</Icon>
              <span>{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
