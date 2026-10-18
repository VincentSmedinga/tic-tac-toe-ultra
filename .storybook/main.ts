import { defineMain } from '@storybook/react-vite/node'

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    // Not the game's vite.config.ts: that one runs the Cloudflare plugin (the Worker), which a
    // style guide has no use for.
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } },
  },
  // Stories sit next to the part they show, like its CSS and its tests. Nothing in the game imports
  // a story, so the game's build (`pnpm build`) never contains one.
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  // Nothing about this project goes to third parties.
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
})
