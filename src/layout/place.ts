import type { Route } from '../online/route.ts'

export type Place = 'start' | 'games' | 'stats' | 'settings'

/** Which of the four places a screen belongs to; a game being played belongs to none of them. */
export function placeOf(route: Route): Place | null {
  switch (route.name) {
    // A house is where you start a game from.
    case 'start':
    case 'house':
      return 'start'
    case 'games':
    case 'game':
      return 'games'
    case 'stats':
      return 'stats'
    case 'settings':
      return 'settings'
    default:
      return null
  }
}
