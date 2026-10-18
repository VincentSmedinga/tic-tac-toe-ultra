import { useState } from 'react'
import { useText } from '../i18n/store.ts'

interface CopyLinkProps {
  link: string
  /** What the link is for, said above it. */
  lead: string
}

/** A link to hand to someone, shown in full, with a button that copies it. */
export function CopyLink({ link, lead }: CopyLinkProps) {
  const t = useText()
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="share">
      <p>{lead}</p>
      <p className="share-link">{link}</p>
      <button
        type="button"
        className="button"
        onClick={() => {
          void copy()
        }}
      >
        {t('copy.button')}
      </button>
      {copied === 'yes' && <p role="status">{t('copy.done')}</p>}
      {copied === 'no' && <p role="status">{t('copy.failed')}</p>}
    </div>
  )
}
