import './Wordmark.css'

/**
 * The name of the game as a title, "Boter, Kaas en Eieren Ultra", with the app icon to the left of
 * it, as high as the title's two lines. The icon is the picture in `public/icon.svg`, the same one
 * that is on the home screen (see scripts/icons.ts), in the same dark square in every look.
 */
export function Wordmark() {
  return (
    <h1 className="wordmark">
      <img className="wordmark-logo" src="/icon.svg" alt="" width="512" height="512" />
      <span className="wordmark-text">Boter, Kaas en Eieren Ultra</span>
    </h1>
  )
}
