'use client'

import { useState, type ReactNode } from 'react'

interface TooltipProps {
  content:  ReactNode
  children: ReactNode
  side?:    'top' | 'bottom' | 'left' | 'right'
  /** When true (default), renders an info-icon trigger right after the children. Set false if children is its own trigger (e.g. a button). */
  withIcon?: boolean
}

const POSITION_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
}

const ARROW_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top:    'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
  left:   'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
  right:  'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
      <line x1="8" y1="7.5" x2="8" y2="11.5" />
      <circle cx="8" cy="5" r="0.5" fill="currentColor" />
    </svg>
  )
}

/**
 * Lightweight pure-CSS tooltip. Shows on hover or keyboard focus of the
 * trigger. Drop next to a label or wrap a button:
 *
 *   <label>Voice quota
 *     <Tooltip content="Counted across all calls per billing period." />
 *   </label>
 *
 *   <Tooltip content="Hangs up the campaign immediately." withIcon={false}>
 *     <button>Cancel</button>
 *   </Tooltip>
 */
export function Tooltip({ content, children, side = 'top', withIcon = true }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {withIcon && (
        <button
          type="button"
          tabIndex={0}
          aria-label="Help"
          onClick={(e) => { e.preventDefault(); setOpen(o => !o) }}
          className="ml-1 inline-flex items-center justify-center rounded-full"
          style={{ color: 'var(--text-tertiary)', width: '14px', height: '14px' }}
        >
          <InfoIcon />
        </button>
      )}
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 pointer-events-none px-2.5 py-1.5 rounded-md text-xs font-normal whitespace-normal max-w-xs ${POSITION_CLASSES[side]}`}
          style={{
            background: 'oklch(20% 0.02 270)',
            color:      'oklch(96% 0.005 270)',
            boxShadow:  '0 4px 12px oklch(20% 0.02 270 / 0.25)',
            lineHeight: 1.45,
            minWidth:   '160px',
          }}
        >
          {content}
          <span
            className={`absolute w-0 h-0 border-4 ${ARROW_CLASSES[side]}`}
            style={{
              borderColor: 'oklch(20% 0.02 270)',
            }}
          />
        </span>
      )}
    </span>
  )
}
