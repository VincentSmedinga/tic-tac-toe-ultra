/** Set by vite.config.ts at build time: the short commit the game was built from. */
declare const __APP_VERSION__: string | undefined

/** What to call this build; "dev" where nothing set it (`pnpm dev`, the tests, the style guide). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
