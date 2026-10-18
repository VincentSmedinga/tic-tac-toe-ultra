import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

describe('App', () => {
  it('shows the name of the game', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Boter, kaas en eieren' })).toBeVisible()
  })
})
