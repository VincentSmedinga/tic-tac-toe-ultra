import { describe, expect, it, vi } from 'vitest'
import { arrivalPlan } from './arrival.ts'
import { GENTLE_MS, playArrival } from './play.ts'

/** An SVG with a few paths, and an `animate` that records what it is asked to play. */
function fakeSvg(paths = 2) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const cancels: ReturnType<typeof vi.fn>[] = []
  const animate = vi.fn((_keyframes: Keyframe[], _options: KeyframeAnimationOptions) => {
    const cancel = vi.fn()
    cancels.push(cancel)
    return { cancel } as unknown as Animation
  })
  const elements = Array.from({ length: paths }, () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.animate = animate
    svg.append(path)
    return path
  })
  svg.animate = animate
  return { svg, animate, cancels, elements }
}

describe('playArrival', () => {
  it('writes every stroke with the delay, the duration and the direction of the plan', () => {
    const { svg, animate } = fakeSvg(2)
    const plan = arrivalPlan(1, 0, 2)
    playArrival(svg, plan, 'full')
    expect(animate).toHaveBeenCalledTimes(2)
    plan.strokes.forEach(({ reverse, delay, duration }, call) => {
      const [keyframes, options] = animate.mock.calls[call] ?? []
      expect(options).toMatchObject({ delay, duration, easing: plan.easing, fill: 'backwards' })
      expect(keyframes?.[0]).toMatchObject({ strokeDashoffset: reverse ? -1 : 1, opacity: 0 })
      expect(keyframes?.at(-1)).toMatchObject({ strokeDashoffset: 0, opacity: 1 })
    })
  })

  it('moves nothing but the stroke and its opacity', () => {
    const { svg, animate } = fakeSvg(1)
    playArrival(svg, arrivalPlan(2, 0, 1), 'full')
    const properties = new Set(
      animate.mock.calls.flatMap(([keyframes]) =>
        keyframes.flatMap((keyframe) => Object.keys(keyframe)),
      ),
    )
    expect(properties).toEqual(
      new Set(['strokeDasharray', 'strokeDashoffset', 'opacity', 'offset']),
    )
  })

  it('only fades the whole shape in when less motion is wanted', () => {
    const { svg, animate, elements } = fakeSvg(3)
    playArrival(svg, arrivalPlan(1, 0, 3), 'gentle')
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.calls[0]?.[0]).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: GENTLE_MS })
    expect(elements).toHaveLength(3)
  })

  it('stops every animation when it is cut short', () => {
    const { svg, cancels } = fakeSvg(3)
    const stop = playArrival(svg, arrivalPlan(1, 0, 3), 'full')
    stop()
    expect(cancels).toHaveLength(3)
    for (const cancel of cancels) expect(cancel).toHaveBeenCalledOnce()
  })

  it('shows the shape at once where the browser cannot animate', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    expect(() => {
      playArrival(svg, arrivalPlan(1, 0, 1), 'full')()
    }).not.toThrow()
  })
})
