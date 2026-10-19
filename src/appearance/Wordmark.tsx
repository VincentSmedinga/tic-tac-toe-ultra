import { useText } from '../i18n/store.ts'
import { Link } from '../online/Link.tsx'
import './Wordmark.css'

/**
 * The name of the game as a title, "Boter, Kaas en Eieren Ultra", with the app icon to the left of
 * it, as high as the title's two lines, and a link to the start. The icon is the picture in `public/icon.svg`, the same one
 * that is on the home screen (see scripts/icons.ts), in the same dark square in every look.
 */
export function Wordmark() {
  const t = useText()
  return (
    <h1 className="wordmark">
      {/* The icon takes you to the start, as an icon does. The menu has the start as a link of its own,
          which is the one for the keyboard and for screen readers. */}
      <Link to="/" className="wordmark-link" decorative>
        <img className="wordmark-logo" src="/icon.svg" alt="" width="512" height="512" />
      </Link>
      <span className="wordmark-text">{t('app.title')}</span>
    </h1>
  )
}
