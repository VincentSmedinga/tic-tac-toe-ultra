// Sets the look, light or dark and the language before the first paint, so a dark phone never
// flashes light, nobody sees the wrong look for a moment, and a screen reader and the tab say the
// right language from the start. Runs as a classic script in <head>; src/appearance/look.ts,
// scheme.ts and src/i18n/ take over once the app has loaded. Keep them in sync (language.test.ts
// runs this script and compares).
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

  // The languages and the title of the page in each. Dutch comes first and is what there is when
  // the choice is none of ours. `reviewed` is false for a language nobody has read yet: it is
  // never picked from the browser's languages, only when it was chosen.
  const languages = [
    { id: 'nl', title: 'Boter, Kaas en Eieren Ultra', reviewed: true },
    { id: 'en', title: 'Tic-Tac-Toe Ultra', reviewed: true },
    { id: 'fy', title: 'Bûter, Tsiis en Aaien Ultra', reviewed: true },
  ]
  let chosen = languages[0]
  try {
    const saved = languages.find(
      ({ id }) => id === localStorage.getItem('tic-tac-toe-ultra.language'),
    )
    if (saved) chosen = saved
    else {
      const tags = navigator.languages.length > 0 ? navigator.languages : [navigator.language]
      for (const tag of tags) {
        const found = languages.find(
          ({ id, reviewed }) => reviewed && id === tag.toLowerCase().split('-')[0],
        )
        if (found) {
          chosen = found
          break
        }
      }
    }
  } catch {
    // Storage or the browser's languages can be unreadable: Dutch.
  }
  document.documentElement.lang = chosen.id
  document.title = chosen.title
})()
