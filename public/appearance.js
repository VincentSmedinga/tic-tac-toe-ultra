// Sets the look and light or dark before the first paint, so a dark phone never flashes light and
// nobody sees the wrong look for a moment. Runs as a classic script in <head>;
// src/appearance/look.ts and scheme.ts take over once the app has loaded. Keep them in sync.
;(() => {
  let look = 'drawn'
  let preference = 'system'
  try {
    const savedLook = localStorage.getItem('tic-tac-toe-ultra.look')
    if (savedLook === 'drawn' || savedLook === 'playful' || savedLook === 'calm') look = savedLook
    preference = localStorage.getItem('tic-tac-toe-ultra.scheme') ?? 'system'
  } catch {
    // Storage can be blocked: the first look, and the system's scheme.
  }
  const dark =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.look = look
  document.documentElement.dataset.scheme = dark ? 'dark' : 'light'
})()
