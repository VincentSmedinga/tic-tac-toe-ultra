import type { ReactNode } from 'react'
import { navigate } from './route.ts'

interface LinkProps {
  to: string
  children: ReactNode
  className?: string
  /** The link to the screen you are on. */
  current?: boolean
  /** A second way to the same place, for a pointer only (the logo): out of the tab order and hidden from screen readers. */
  decorative?: boolean
}

/** A link inside the app: a click goes there without loading the page again. */
export function Link({ to, children, className, current, decorative }: LinkProps) {
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? 'page' : undefined}
      aria-hidden={decorative ? true : undefined}
      tabIndex={decorative ? -1 : undefined}
      onClick={(event) => {
        // Let the browser handle a click that opens a new tab or window.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
