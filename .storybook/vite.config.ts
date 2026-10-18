import { defineConfig } from 'vite'

// Storybook adds the React plugin itself. Not the game's public/ folder: it holds the game's own
// headers (a Content-Security-Policy that Storybook can't run under), icons and manifest;
// Storybook's static files are in .storybook/public/ (see main.ts).
export default defineConfig({ publicDir: false })
