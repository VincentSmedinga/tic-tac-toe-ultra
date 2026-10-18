import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { SHAPES } from '../shapes/shapes.ts'
import { contrast, themes } from '../styles/tokens.ts'
import './StyleGuide.css'

// Everything is read from the CSS of the game, so a token that is added shows up here by itself:
// the colours from tokens.css (the same way the tests read them), the rest from the styles of the
// page as the look and light or dark in the toolbar have them.
const stylesheets = import.meta.glob<string>('../styles/{tokens,look-*}.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const meta = {
  title: 'Basis/Tokens',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** What a colour has to give against the page: 3:1 for lines and shapes, 4.5:1 for text. */
function requirement(name: string): number {
  return name === '--text' ? 4.5 : 3
}

function ColourTable({ scheme }: { scheme: 'light' | 'dark' }) {
  const colours = themes[scheme]
  const page = colours['--page'] ?? '#ffffff'
  const text = colours['--text'] ?? '#000000'
  const names = Object.keys(colours)
  const rows = (list: string[]) =>
    list.map((name) => {
      const colour = colours[name] ?? ''
      const ratio = contrast(colour, page)
      const passes = ratio >= requirement(name)
      return (
        <tr key={name}>
          <td>
            <span className="guide-swatch" style={{ background: colour }} />
          </td>
          <td>
            <code>{name}</code>
          </td>
          <td>
            <code>{colour}</code>
          </td>
          <td className={passes ? 'guide-pass' : 'guide-fail'}>
            {ratio.toFixed(1)}:1 {passes ? '✓' : '✗'}
          </td>
        </tr>
      )
    })
  return (
    <section
      className="guide-scheme"
      style={
        {
          '--guide-page': page,
          '--guide-text': text,
        } as React.CSSProperties
      }
      aria-labelledby={`colours-${scheme}`}
    >
      <h3 id={`colours-${scheme}`}>{scheme === 'light' ? 'Licht' : 'Donker'}</h3>
      <table className="guide-table">
        <caption className="guide-hidden">
          Kleuren van het {scheme === 'light' ? 'lichte' : 'donkere'} schema, met hun contrast met
          de pagina
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="guide-hidden">Kleur</span>
            </th>
            <th scope="col">Token</th>
            <th scope="col">Waarde</th>
            <th scope="col">Contrast met --page</th>
          </tr>
        </thead>
        <tbody>
          {rows(names.filter((name) => !name.startsWith('--shape-') && name !== '--page'))}
          {rows(SHAPES.map(({ id }) => `--shape-${id}`).filter((name) => names.includes(name)))}
          {/* A shape colour that was added to the tokens but not yet to the shapes. */}
          {rows(
            names.filter(
              (name) =>
                name.startsWith('--shape-') && !SHAPES.some(({ id }) => name === `--shape-${id}`),
            ),
          )}
        </tbody>
      </table>
    </section>
  )
}

/** The colours of both schemes, each on its own page colour, with what they give against it. */
export const Colours: Story = {
  render: () => (
    <div className="guide">
      <h2>Kleuren</h2>
      <p className="guide-note">
        Uit <code>src/styles/tokens.css</code>. Lijnen en vormen moeten minstens 3:1 halen tegen de
        pagina, tekst 4,5:1 (<code>tokens.test.ts</code> bewaakt dat).
      </p>
      <div className="guide-schemes">
        <ColourTable scheme="light" />
        <ColourTable scheme="dark" />
      </div>
    </div>
  ),
}

/** The custom properties of the page, as the look and scheme in the toolbar have set them. */
function useComputedTokens(names: string[]): Record<string, string> {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]))
  }
  const [values, setValues] = useState(read)
  useEffect(() => {
    const update = () => {
      setValues(read())
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true })
    return () => {
      observer.disconnect()
    }
    // `read` only closes over `names`, which is stable for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return values
}

/** Every custom property the stylesheets declare that is not a colour of tokens.css. */
const OTHER_TOKENS = [
  ...new Set(
    Object.values(stylesheets).flatMap((css) =>
      [...css.matchAll(/^\s*(--[a-z][\w-]*):/gm)].map(([, name = '']) => name),
    ),
  ),
]
  .filter((name) => !name.startsWith('--shape-') && !(name in themes.light))
  // A background picture as a value is no use in a table.
  .filter((name) => name !== '--paper-grain')
  .sort()

const isFont = (name: string) => name.startsWith('--font')
const isSize = (name: string) => name.startsWith('--size')
const isRadius = (name: string) => name.includes('radius')

/** Radius, type and the rest of the tokens, with their value in the look that is on. */
export const Shape: Story = {
  name: 'Radius en letters',
  render: function Render() {
    const values = useComputedTokens(OTHER_TOKENS)
    const shown = (list: string[]) => list.filter((name) => values[name])
    const fonts = shown(OTHER_TOKENS.filter(isFont))
    const sizes = shown(OTHER_TOKENS.filter(isSize))
    const radii = shown(OTHER_TOKENS.filter(isRadius))
    const rest = shown(
      OTHER_TOKENS.filter((name) => !isFont(name) && !isSize(name) && !isRadius(name)),
    )
    return (
      <div className="guide">
        <h2>Letters</h2>
        <p className="guide-note">
          Zoals het thema in de werkbalk ze zet; wissel van thema en de waarden volgen.
        </p>
        {fonts.map((name) => (
          <p key={name} className="guide-sample" style={{ fontFamily: `var(${name})` }}>
            <code>{name}</code> Boter, kaas en eieren — {values[name]}
          </p>
        ))}
        {sizes.map((name) => (
          <p key={name} className="guide-sample" style={{ fontSize: `var(${name})` }}>
            <code>{name}</code> Boter, kaas en eieren — {values[name]}
          </p>
        ))}
        <h2>De koppen en de tekst</h2>
        <p className="guide-note">De echte elementen, zoals ze in het spel zijn gezet.</p>
        <h1>Koptekst 1</h1>
        <h2>Koptekst 2</h2>
        <p>Gewone tekst, in de grootte van de tekst van het spel.</p>
        <h2>Afronding</h2>
        <div className="guide-row">
          {radii.map((name) => (
            <span key={name}>
              <span className="guide-radius" style={{ borderRadius: `var(${name})` }} />{' '}
              <code>{name}</code> {values[name]}
            </span>
          ))}
        </div>
        <h2>De rest</h2>
        <table className="guide-table">
          <caption className="guide-hidden">Overige tokens met hun waarde in dit thema</caption>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Waarde</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((name) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>
                  <code>{values[name]}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
}
