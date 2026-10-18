import { useState } from 'react'

interface CopyLinkProps {
  link: string
  /** What the link is for, said above it. */
  lead: string
}

/** A link to hand to someone, shown in full, with a button that copies it. */
export function CopyLink({ link, lead }: CopyLinkProps) {
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
        Kopieer link
      </button>
      {copied === 'yes' && <p role="status">Link gekopieerd.</p>}
      {copied === 'no' && (
        <p role="status">Kopiëren lukt niet. Selecteer de link hierboven en kopieer hem zelf.</p>
      )}
    </div>
  )
}
