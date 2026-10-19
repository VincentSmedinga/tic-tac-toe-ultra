import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBarCover } from './StatusBarCover.tsx'

describe('StatusBarCover', () => {
  it('is only for the eye and holds a wallpaper of its own', () => {
    const { container } = render(<StatusBarCover />)
    const cover = container.querySelector('.status-bar-cover')
    expect(cover?.getAttribute('aria-hidden')).toBe('true')
    expect(cover?.querySelector('.wallpaper')).not.toBeNull()
  })
})
