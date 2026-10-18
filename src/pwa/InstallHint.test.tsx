import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { InstallHint } from './InstallHint.tsx'
import { forgetTip, listenForInstallPrompt } from './install.ts'

const SAFARI_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1'
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1'
const CHROME_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

function device(userAgent: string, touchPoints = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  // jsdom has no touch screen at all, so there is nothing to spy on.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
}

function installedApp(standalone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeAll(() => {
  listenForInstallPrompt()
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'standalone')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  forgetTip()
})

const TIP = 'Tik op Deel en kies Zet op beginscherm.'

describe('InstallHint on an iPad or iPhone', () => {
  it('says where to tap, in Safari on an iPhone', () => {
    device(SAFARI_IPHONE, 5)
    render(<InstallHint />)
    expect(screen.getByText(TIP)).toBeVisible()
  })

  it('says it on an iPad that asks for the desktop site, which says it is a Mac', () => {
    device(SAFARI_IPAD, 5)
    render(<InstallHint />)
    expect(screen.getByText(TIP)).toBeVisible()
  })

  it('says nothing on a Mac, which has no touch screen', () => {
    device(SAFARI_IPAD, 0)
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })

  it('says nothing in Chrome on an iPhone, nor on a desktop', () => {
    device(CHROME_IPHONE, 5)
    const { unmount } = render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
    unmount()
    device(CHROME_DESKTOP, 0)
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })

  it('says nothing in the app on the home screen', () => {
    device(SAFARI_IPHONE, 5)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })

  it('says nothing in the installed app that is recognised by its display mode', () => {
    device(SAFARI_IPHONE, 5)
    installedApp(true)
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })

  it('can be closed for good', async () => {
    device(SAFARI_IPHONE, 5)
    installedApp(false)
    const { unmount } = render(<InstallHint />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Niet meer tonen' }))
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('tic-tac-toe-ultra.install-tip-closed')).toBe('yes')

    // The next visit reads it from the browser, whatever this page remembers.
    unmount()
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('yes')
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })

  it('stays closed for the visit when the browser remembers nothing', async () => {
    device(SAFARI_IPHONE, 5)
    installedApp(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { unmount } = render(<InstallHint />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Niet meer tonen' }))
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()

    unmount()
    render(<InstallHint />)
    expect(screen.queryByText(TIP)).not.toBeInTheDocument()
  })
})

describe('InstallHint where the browser can install the app', () => {
  it('offers a button once the browser says so, which asks the person to install', async () => {
    device(CHROME_DESKTOP, 0)
    installedApp(false)
    render(<InstallHint />)
    expect(screen.queryByRole('button', { name: 'Installeer de app' })).not.toBeInTheDocument()

    const prompt = vi.fn(() => Promise.resolve())
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    // The browser's own bar is kept away, the button takes its place.
    expect(event.defaultPrevented).toBe(true)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Installeer de app' }))
    expect(prompt).toHaveBeenCalledTimes(1)
    // The event can be used once: the button goes until the browser offers it again.
    expect(screen.queryByRole('button', { name: 'Installeer de app' })).not.toBeInTheDocument()
  })

  it('takes the button away when the app has been installed', () => {
    device(CHROME_DESKTOP, 0)
    installedApp(false)
    render(<InstallHint />)
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
          prompt: () => Promise.resolve(),
          userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
        }),
      )
    })
    expect(screen.getByRole('button', { name: 'Installeer de app' })).toBeVisible()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'Installeer de app' })).not.toBeInTheDocument()
  })
})

describe('InstallHint in the other languages', () => {
  it.each([
    ['en', 'Tap Share and choose Add to Home Screen.', 'Do not show again'],
    ['fy', 'Tik op Diel en kies Set op it startskerm.', 'Net mear sjen litte'],
  ] as const)('says where to tap, and how to close it, in %s', (language, tip, close) => {
    setLanguage(language)
    device(SAFARI_IPHONE, 5)
    render(<InstallHint />)
    expect(screen.getByText(tip)).toBeVisible()
    expect(screen.getByRole('button', { name: close })).toBeVisible()
  })
})
