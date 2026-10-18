import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './register.ts'

function setup({ controlled = true, path = '/kamer/BCDF' } = {}) {
  const container = new EventTarget() as EventTarget & {
    controller: object | null
    register: ReturnType<typeof vi.fn>
  }
  container.controller = controlled ? {} : null
  const registration = { update: vi.fn(() => Promise.resolve()) }
  container.register = vi.fn(() => Promise.resolve(registration))
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const reload = vi.fn()
  registerServiceWorker({
    container: container as unknown as ServiceWorkerContainer,
    page: page as unknown as Document,
    reload,
    pathname: () => path,
  })
  const setVisibility = (state: 'visible' | 'hidden') => {
    page.visibilityState = state
    page.dispatchEvent(new Event('visibilitychange'))
  }
  return {
    container,
    registration,
    reload,
    setVisibility,
    takeOver: () => container.dispatchEvent(new Event('controllerchange')),
  }
}

describe('registerServiceWorker', () => {
  it('registers the worker from the root', () => {
    const { container } = setup()
    expect(container.register).toHaveBeenCalledWith('/sw.js')
  })

  it('asks for a newer worker every time the app comes back into sight', async () => {
    const { registration, setVisibility } = setup()
    await Promise.resolve()
    setVisibility('hidden')
    expect(registration.update).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('does not load the page again for the first worker', () => {
    const { reload, takeOver, setVisibility } = setup({ controlled: false })
    takeOver()
    setVisibility('hidden')
    expect(reload).not.toHaveBeenCalled()
  })

  it('loads the page again for a new version when the app is out of sight, not while it is in use', () => {
    const { reload, takeOver, setVisibility } = setup()
    takeOver()
    expect(reload).not.toHaveBeenCalled()
    setVisibility('hidden')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('also does that for the second worker of a page that started without one', () => {
    const { reload, takeOver, setVisibility } = setup({ controlled: false })
    takeOver()
    takeOver()
    setVisibility('hidden')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never loads the game on one screen again, which lives only in the page', () => {
    const { reload, takeOver, setVisibility } = setup({ path: '/samen' })
    takeOver()
    setVisibility('hidden')
    expect(reload).not.toHaveBeenCalled()
  })
})
