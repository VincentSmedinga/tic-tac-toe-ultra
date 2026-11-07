import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInThisContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DICTIONARIES } from './dictionaries.ts'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  STORAGE_KEY,
  isLanguage,
  isPreview,
  localeOf,
  matchLanguage,
  offeredLanguages,
  readLanguage,
  saveLanguage,
} from './language.ts'
import { applyLanguage, getLanguage, setLanguage, textFor } from './store.ts'

// vitest runs from the root of the repository.
const script = (name: string) => readFileSync(resolve('public', name), 'utf8')

afterEach(() => {
  window.localStorage.clear()
})

describe('the languages', () => {
  it('are Dutch first, then English, Frisian and Romanian, each named in its own language', () => {
    expect(LANGUAGES.map(({ id, name }) => [id, name])).toEqual([
      ['nl', 'Nederlands'],
      ['en', 'English'],
      ['fy', 'Frysk'],
      ['ro', 'Română'],
    ])
    expect(DEFAULT_LANGUAGE).toBe('nl')
    expect(isLanguage('fy')).toBe(true)
    expect(isLanguage('de')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })

  it('are offered once a person who speaks them has read them: Romanian is not yet', () => {
    expect(LANGUAGES.map(({ reviewed }) => reviewed)).toEqual([true, true, true, false])
    expect(offeredLanguages(false, 'nl').map(({ id }) => id)).toEqual(['nl', 'en', 'fy'])
    expect(offeredLanguages(true, 'nl').map(({ id }) => id)).toEqual(['nl', 'en', 'fy', 'ro'])
    expect(offeredLanguages(false, 'ro').map(({ id }) => id)).toEqual(['nl', 'en', 'fy', 'ro'])
  })

  describe('that nobody has read yet (a new one, say)', () => {
    // The registry as it will be when a language is added: written, but not read by a person.
    const unread = [
      LANGUAGES[0],
      LANGUAGES[1],
      { ...LANGUAGES[2], reviewed: false },
      LANGUAGES[3],
    ] as const

    it('are not offered, until the address asks for every language', () => {
      expect(offeredLanguages(false, 'nl', unread).map(({ id }) => id)).toEqual(['nl', 'en'])
      expect(offeredLanguages(true, 'nl', unread).map(({ id }) => id)).toEqual([
        'nl',
        'en',
        'fy',
        'ro',
      ])
    })

    it('keep the language in use in the list, so that it can be changed back', () => {
      expect(offeredLanguages(false, 'fy', unread).map(({ id }) => id)).toEqual(['nl', 'en', 'fy'])
    })

    it('are not picked from the browser, which goes on to the next language', () => {
      expect(matchLanguage(['fy-NL', 'en'], unread)).toBe('en')
      expect(matchLanguage(['fy'], unread)).toBe('nl')
    })
  })

  it('are all previewed with ?alle-talen in the address', () => {
    expect(isPreview('?alle-talen')).toBe(true)
    expect(isPreview('?alle-talen=1&x=2')).toBe(true)
    expect(isPreview('')).toBe(false)
  })

  it('are always offered on the preview of a pull request, and nowhere else', () => {
    expect(isPreview('', 'tic-tac-toe-ultra-pr-90.v-smedinga.workers.dev')).toBe(true)
    expect(isPreview('', 'tic-tac-toe-ultra.v-smedinga.workers.dev')).toBe(false)
    expect(isPreview('', 'tic-tac-toe-ultra-styleguide-pr-90.v-smedinga.workers.dev')).toBe(false)
    expect(isPreview('', 'localhost')).toBe(false)
  })
})

describe('following the browser', () => {
  it('takes the first language of the browser that the game has', () => {
    expect(matchLanguage(['en-GB', 'nl'])).toBe('en')
    expect(matchLanguage(['de', 'nl-BE', 'en'])).toBe('nl')
    expect(matchLanguage(['EN-us'])).toBe('en')
  })

  it('is Dutch when it is none of ours, or nothing is asked', () => {
    expect(matchLanguage(['de', 'ja'])).toBe('nl')
    expect(matchLanguage([])).toBe('nl')
  })

  it('does not pick Romanian, which nobody has read yet', () => {
    expect(matchLanguage(['ro-RO', 'en'])).toBe('en')
    expect(matchLanguage(['ro'])).toBe('nl')
  })

  it('picks Frisian for a browser that asks for it', () => {
    expect(matchLanguage(['fy-NL', 'en'])).toBe('fy')
    expect(matchLanguage(['fy'])).toBe('fy')
  })
})

describe('the language of this device', () => {
  it('is the browser’s until another is chosen, and then the choice', () => {
    expect(readLanguage(undefined, ['en-GB'])).toBe('en')
    saveLanguage('nl')
    expect(readLanguage(undefined, ['en-GB'])).toBe('nl')
  })

  it('keeps a chosen Frisian', () => {
    saveLanguage('fy')
    expect(readLanguage(undefined, ['nl'])).toBe('fy')
  })

  it('keeps a chosen Romanian, even though the browser does not pick it', () => {
    saveLanguage('ro')
    expect(readLanguage(undefined, ['nl'])).toBe('ro')
  })

  it('ignores anything in storage that is not a language', () => {
    window.localStorage.setItem(STORAGE_KEY, 'toString')
    expect(readLanguage(undefined, ['en'])).toBe('en')
  })

  it('falls back to the browser when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readLanguage(undefined, ['en'])).toBe('en')
    vi.restoreAllMocks()
  })
})

describe('the locale for dates and numbers', () => {
  it('is the language’s own where the browser knows it', () => {
    expect(localeOf('nl')).toBe('nl-NL')
    expect(localeOf('en')).toBe('en-GB')
    expect(localeOf('fy')).toBe('fy-NL')
    expect(localeOf('ro')).toBe('ro-RO')
  })

  it('is Dutch where the browser does not know the language', () => {
    vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf').mockImplementation((tags) =>
      (tags as string[]).filter((tag) => tag !== 'fy-NL'),
    )
    expect(localeOf('fy')).toBe('nl-NL')
    expect(localeOf('en')).toBe('en-GB')
    vi.restoreAllMocks()
  })
})

describe('the language of the page', () => {
  it('puts lang, the direction and the title on the page', () => {
    applyLanguage('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.title).toBe('Tic-Tac-Toe Ultra')
    applyLanguage('nl')
    expect(document.documentElement.lang).toBe('nl')
    expect(document.title).toBe('Boter, Kaas en Eieren Ultra')
  })

  it('changes with the choice, which is kept', () => {
    expect(getLanguage()).toBe('nl')
    setLanguage('en')
    expect(getLanguage()).toBe('en')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})

describe('public/appearance.js, which sets the language before the first paint', () => {
  /** Runs the script on a fresh page, as the browser would, and says what it left on it. */
  function runWith(saved: string | null, tags: string[]) {
    window.localStorage.clear()
    if (saved !== null) window.localStorage.setItem(STORAGE_KEY, saved)
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(tags)
    document.documentElement.lang = ''
    document.title = ''
    runInThisContext(script('appearance.js'))
    return { lang: document.documentElement.lang, title: document.title }
  }

  it.each([
    [null, ['nl-NL']],
    [null, ['en-US', 'en']],
    [null, ['de', 'en']],
    [null, ['de']],
    [null, []],
    [null, ['fy-NL', 'nl']],
    [null, ['fy-NL', 'en']],
    ['en', ['nl']],
    ['fy', ['nl']],
    ['ro', ['nl']],
    [null, ['ro-RO', 'en']],
    ['nl', ['en']],
    ['xx', ['en']],
  ] as const)('does what the app does: saved %s, browser %j', (saved, tags) => {
    const page = runWith(saved, [...tags])
    const expected = readLanguage(undefined, [...tags])
    expect(page.lang).toBe(expected)
    expect(page.title).toBe(DICTIONARIES[expected]['app.title'])
  })

  it('says Dutch when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    runInThisContext(script('appearance.js'))
    expect(document.documentElement.lang).toBe('nl')
    vi.restoreAllMocks()
  })
})

describe('public/offline.html, the page of the service worker', () => {
  const page = script('offline.html')

  it('is in Dutch, and says the same as the dictionary', () => {
    expect(page).toContain('lang="nl"')
    for (const key of ['offline.title', 'offline.body', 'offline.retry'] as const) {
      expect(page).toContain(DICTIONARIES.nl[key] as string)
    }
  })

  it.each(['en', 'fy', 'ro'] as const)(
    'has the texts of %s in a script that reads the choice',
    (id) => {
      for (const key of ['offline.title', 'offline.body', 'offline.retry'] as const) {
        expect(page).toContain(DICTIONARIES[id][key] as string)
      }
      expect(page).toContain(STORAGE_KEY)
    },
  )
})

describe('textFor', () => {
  it('gives the same function for the same language', () => {
    expect(textFor('en')).toBe(textFor('en'))
    expect(textFor('en')('app.title')).toBe('Tic-Tac-Toe Ultra')
  })
})
