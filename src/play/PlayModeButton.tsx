import { useText } from '../i18n/store.ts'

/**
 * "Volledig scherm" near the board, "Sluiten" in the mode: a pressed button that is as high as a
 * finger needs (48 px). Left out where the mode has nothing to do (an installed app). F on the board
 * does the same.
 */
export function PlayModeButton({
  on,
  available,
  toggle,
  attachTrigger,
}: {
  on: boolean
  available: boolean
  toggle: () => void
  /** The `ref` of the button, so that the mode can give the focus back to it. */
  attachTrigger: (element: HTMLButtonElement | null) => void
}) {
  const t = useText()
  if (!available) return null
  return (
    <button
      ref={attachTrigger}
      type="button"
      className="rematch rematch-quiet play-mode-button"
      aria-pressed={on}
      aria-keyshortcuts="F"
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d={
            on ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6' : 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6'
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{t(on ? 'playMode.close' : 'playMode.open')}</span>
    </button>
  )
}
