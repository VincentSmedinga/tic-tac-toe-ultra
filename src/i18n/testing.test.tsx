import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dutchLeaks, visibleTexts } from './testing.ts'

describe('dutchLeaks', () => {
  it('finds a Dutch text, also with a name filled in or in a label, on a page that is not Dutch', () => {
    render(
      <div>
        <p>Anna (kruis) heeft gewonnen!</p>
        <button aria-label="Naar het begin">x</button>
        <p>Cross has won!</p>
      </div>,
    )
    expect(dutchLeaks('en')).toEqual(['Anna (kruis) heeft gewonnen!', 'Naar het begin'])
  })

  it('does not blame a text that is the same in both languages', () => {
    render(<button>Start</button>)
    expect(dutchLeaks('en')).toEqual([])
  })

  it('reads the labels, titles and text of what is on screen', () => {
    render(
      <p title="a">
        b<span aria-label="c">d</span>
      </p>,
    )
    expect(visibleTexts().sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
