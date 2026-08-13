import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InfoIcon } from './Icons'

// Small (i) icon with a hover/focus tooltip explaining a calculation. Portaled to
// <body> and positioned via the icon's own rect, so it escapes any ancestor's
// `overflow-hidden` (e.g. a rounded table card) instead of being clipped by it.
export default function InfoHint({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  function show() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 8, left: Math.min(Math.max(rect.left + rect.width / 2, 128), window.innerWidth - 128) })
  }

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        className="inline-flex text-faint focus:outline-none"
      >
        <InfoIcon />
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
            className="z-50 w-60 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-muted shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  )
}
