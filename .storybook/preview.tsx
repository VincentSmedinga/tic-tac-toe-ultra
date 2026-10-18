// The same styles as src/main.tsx: the tokens and the three looks.
import '../src/styles.css'

import addonA11y from '@storybook/addon-a11y'
import { definePreview } from '@storybook/react-vite'
import { useEffect } from 'react'
import { useGlobals } from 'storybook/preview-api'
import { LOOKS, applyLook, isLook, saveLook } from '../src/appearance/look.ts'
import type { LookId } from '../src/appearance/look.ts'
import { applyScheme, savePreference } from '../src/appearance/scheme.ts'
import type { Scheme } from '../src/appearance/scheme.ts'

/**
 * The two switches of the game, in the toolbar: the look (`data-look`) and light or dark
 * (`data-scheme`) on <html>, put there by the game's own `applyLook` and `applyScheme`. The footer
 * of the game changes the same two attributes, so the toolbar follows them.
 */
export default definePreview({
  initialGlobals: { look: 'drawn', scheme: 'light' },
  globalTypes: {
    look: {
      description: 'Thema (data-look)',
      toolbar: {
        title: 'Thema',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: LOOKS.map(({ id, name }) => ({ value: id, title: name })),
      },
    },
    scheme: {
      description: 'Licht of donker (data-scheme)',
      toolbar: {
        title: 'Licht of donker',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Licht', icon: 'sun' },
          { value: 'dark', title: 'Donker', icon: 'moon' },
        ],
      },
    },
  },
  decorators: [
    (Story, { globals }) => {
      const [, updateGlobals] = useGlobals()
      const look = isLook(String(globals.look)) ? (globals.look as LookId) : 'drawn'
      const scheme: Scheme = globals.scheme === 'dark' ? 'dark' : 'light'

      // What the footer of the game reads when it is shown (see its story).
      saveLook(look)
      savePreference(scheme)

      useEffect(() => {
        applyLook(look)
        applyScheme(scheme)
      }, [look, scheme])

      // The footer changes the look and the scheme itself: the toolbar follows.
      useEffect(() => {
        const root = document.documentElement
        const observer = new MutationObserver(() => {
          const nextLook = root.dataset.look
          const nextScheme = root.dataset.scheme
          if (nextLook !== look || nextScheme !== scheme) {
            updateGlobals({ look: nextLook, scheme: nextScheme })
          }
        })
        observer.observe(root, { attributes: true, attributeFilter: ['data-look', 'data-scheme'] })
        return () => {
          observer.disconnect()
        }
      }, [look, scheme, updateGlobals])

      return <Story />
    },
  ],
  parameters: {
    // The page's own background, from the tokens and the look, so the switches change it too.
    backgrounds: { disable: true },
    layout: 'padded',
    // The devices of the end-to-end tests and of the family (playwright.config.ts).
    viewport: {
      options: {
        phone: {
          name: 'Telefoon (Pixel 7)',
          type: 'mobile',
          styles: { width: '412px', height: '915px' },
        },
        tablet: {
          name: 'Tablet (iPad)',
          type: 'tablet',
          styles: { width: '820px', height: '1180px' },
        },
      },
    },
    options: { storySort: { order: ['Basis', 'Onderdelen'] } },
  },
  addons: [addonA11y()],
})
