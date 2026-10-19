import { useState } from 'react'
import { MAX_NAME_LENGTH } from '../../shared/protocol.ts'
import { AppearanceControls } from '../appearance/AppearanceControls.tsx'
import { LanguageControl } from '../appearance/LanguageControl.tsx'
import { useText } from '../i18n/store.ts'
import { getName, setName } from '../online/identity.ts'
import { InstallHint } from '../pwa/InstallHint.tsx'
import { isStandalone, useCanInstall, useShowIosTip } from '../pwa/install.ts'
import { APP_VERSION } from './version.ts'
import './Settings.css'

const CODE_URL = 'https://github.com/VincentSmedinga/tic-tac-toe-ultra'

/**
 * The settings: how the game looks, the language, the name, how to put the game on a home screen,
 * and what the game is. Everything is kept per device and applied at once; nothing is sent
 * anywhere.
 */
export function SettingsPage() {
  const t = useText()
  const [name, setNameState] = useState(getName)
  // The app's own section is only there where there is something to say (see InstallHint).
  const canInstall = useCanInstall()
  const showTip = useShowIosTip()
  const offerApp = (canInstall && !isStandalone()) || showTip

  return (
    <div className="start settings">
      <h2 className="settings-title">{t('settings.title')}</h2>

      <section className="choice" aria-labelledby="settings-appearance">
        <h2 id="settings-appearance">{t('appearance.label')}</h2>
        <AppearanceControls />
      </section>

      <section className="choice settings-language" aria-label={t('appearance.language')}>
        <LanguageControl />
      </section>

      <section className="choice" aria-labelledby="settings-who">
        <h2 id="settings-who">{t('start.who.title')}</h2>
        <div className="field">
          <label htmlFor="settings-name">{t('start.who.name')}</label>
          <input
            id="settings-name"
            name="given-name"
            type="text"
            // "given-name" is what makes Safari offer the name from the Contacts app.
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => {
              setNameState(event.target.value)
              setName(event.target.value)
            }}
          />
        </div>
      </section>

      {offerApp && (
        <section className="choice" aria-labelledby="settings-app">
          <h2 id="settings-app">{t('settings.app.title')}</h2>
          <InstallHint />
        </section>
      )}

      <section className="choice settings-about" aria-labelledby="settings-about">
        <h2 id="settings-about">{t('settings.about.title')}</h2>
        <p>{t('settings.about.body')}</p>
        <p className="settings-small">{t('settings.about.version', { version: APP_VERSION })}</p>
        <p className="settings-small">{t('settings.about.fonts')}</p>
        <p className="settings-small">
          <a href={CODE_URL} target="_blank" rel="noreferrer">
            {t('settings.about.code')}
          </a>
        </p>
      </section>
    </div>
  )
}
