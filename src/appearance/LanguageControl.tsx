import { isPreview, offeredLanguages } from '../i18n/language.ts'
import { setLanguage, useLanguage, useText } from '../i18n/store.ts'
import { Segmented } from './Segmented.tsx'

/**
 * The choice of language, kept per device. Each language is in its own language, whatever the page
 * is in, and a language nobody has read yet is left out (see language.ts).
 */
export function LanguageControl() {
  const t = useText()
  const language = useLanguage()
  return (
    <Segmented
      label={t('appearance.language')}
      options={offeredLanguages(isPreview(), language).map(({ id, name }) => ({
        value: id,
        label: name,
        lang: id,
      }))}
      value={language}
      onChange={setLanguage}
    />
  )
}
