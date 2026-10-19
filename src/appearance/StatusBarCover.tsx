import { Wallpaper } from './Wallpaper.tsx'

/**
 * The strip of the screen behind the status bar: the page's backdrop and the wallpaper, over
 * everything (look-shared.css says why, issue #77). It is only for the eye.
 */
export function StatusBarCover() {
  return (
    <div className="status-bar-cover" aria-hidden="true">
      <Wallpaper />
    </div>
  )
}
