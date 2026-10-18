import { dismissTip, install, isStandalone, useCanInstall, useShowIosTip } from './install.ts'
import './InstallHint.css'

/**
 * How to put the game on the home screen, in the footer, small: a button where the browser can
 * install it, a tip where it can't be asked for (iPad and iPhone) that can be closed for good.
 * In the installed app, and in any other browser, there is nothing to see.
 */
export function InstallHint() {
  const canInstall = useCanInstall()
  const showTip = useShowIosTip()

  if (canInstall && !isStandalone()) {
    return (
      <div className="install-hint">
        <button type="button" className="install-button" onClick={() => void install()}>
          Installeer de app
        </button>
      </div>
    )
  }
  if (showTip) {
    return (
      <div className="install-hint">
        <p>Tik op Deel en kies Zet op beginscherm.</p>
        <button type="button" className="install-close" onClick={dismissTip}>
          Niet meer tonen
        </button>
      </div>
    )
  }
  return null
}
