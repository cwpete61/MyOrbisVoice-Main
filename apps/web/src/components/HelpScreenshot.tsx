'use client'

import { useState } from 'react'

/**
 * Renders a help-center screenshot slot.
 *
 *  - If a PNG exists at /help-screenshots/<filename>, the image is shown.
 *  - Otherwise (or on load error) a labeled placeholder box appears,
 *    with the expected filename + a description of what the screenshot
 *    should depict. This way the article reads correctly before any
 *    screenshots are captured, AND we have a precise inventory of the
 *    images still to take.
 *
 *  Drop a PNG into apps/web/public/help-screenshots/<filename>, redeploy,
 *  and the placeholder is replaced automatically.
 */
export function HelpScreenshot({ filename, caption }: { filename: string; caption: string }) {
  const [errored, setErrored] = useState(false)
  const src = `/help-screenshots/${filename}`

  if (!errored) {
    return (
      <figure className="my-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          onError={() => setErrored(true)}
          className="rounded-lg w-full"
          style={{ border: '1px solid var(--border-subtle)', display: 'block' }}
        />
        <figcaption className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {caption}
        </figcaption>
      </figure>
    )
  }

  return (
    <div
      className="my-3 mb-4 rounded-lg p-4 flex items-start gap-3"
      style={{
        background: 'oklch(94% 0.04 80 / 0.4)',
        border: '1px dashed oklch(70% 0.10 80)',
        color: 'oklch(35% 0.10 80)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
        <rect x="2" y="3" width="12" height="10" rx="1" />
        <circle cx="11" cy="6" r="1" />
        <path d="M2 11l3-3 3 3 5-5" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5">📷 Screenshot pending</p>
        <p className="text-xs font-mono mb-1.5">{filename}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'oklch(45% 0.12 80)' }}>{caption}</p>
      </div>
    </div>
  )
}
