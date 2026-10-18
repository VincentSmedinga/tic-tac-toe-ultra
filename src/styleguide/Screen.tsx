import type { ReactNode } from 'react'

/**
 * The frame the screens of the game sit in (`.app` with a `main`), so that the looks paint a part in
 * a story as they paint it in the game. Only for the style guide.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="app" style={{ minHeight: 'auto' }}>
      <main>{children}</main>
    </div>
  )
}
