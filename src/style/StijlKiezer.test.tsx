import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StijlKiezer } from './StijlKiezer.tsx'
import { currentStijl, isStijl } from './stijl.ts'

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.stijl
})

describe('the style that is shown', () => {
  it('is the first one until another is asked for', () => {
    expect(currentStijl()).toBe('a')
  })

  it('can be asked for in the address, and that wins over what was chosen before', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.stijl', 'b')
    window.history.pushState(null, '', '/?stijl=c')
    expect(currentStijl()).toBe('c')
  })

  it('does not take a style that does not exist', () => {
    window.history.pushState(null, '', '/?stijl=x')
    expect(currentStijl()).toBe('a')
    expect(isStijl('x')).toBe(false)
  })
})

describe('StijlKiezer', () => {
  it('puts the style on the page and lets the person switch, which is remembered', async () => {
    render(<StijlKiezer />)
    expect(document.documentElement.dataset.stijl).toBe('a')
    expect(screen.getByRole('button', { name: 'Getekend' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Speels' }))
    expect(document.documentElement.dataset.stijl).toBe('b')
    expect(screen.getByRole('button', { name: 'Speels' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.stijl')).toBe('b')
  })
})
