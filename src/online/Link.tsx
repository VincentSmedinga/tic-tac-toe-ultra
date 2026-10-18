import type { ReactNode } from 'react'
import { navigate } from './route.ts'

interface LinkProps {
  to: string
  children: ReactNode
  className?: string
}

/** A link inside the app: a click goes there without loading the page again. */
export function Link({ to, children, className }: LinkProps) {
  return (
    <a
      href={to}
      className={className}
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
