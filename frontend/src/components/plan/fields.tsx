import { useState, type ReactNode } from 'react'

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  placeholder,
  className = '',
}: {
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const pattern = min < 0 ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={`input num ${className}`}
      value={text ?? (value == null ? '' : String(value).replace('.', ','))}
      onChange={(e) => {
        const t = e.target.value.trim()
        if (!pattern.test(t)) return
        setText(t)
        const n = Number(t.replace(',', '.'))
        if (t === '' || t === '-') onChange(null)
        else if (!Number.isNaN(n)) onChange(n)
      }}
      onBlur={() => setText(null)}
    />
  )
}

export function Card({ title, aside, fill = false, children }: { title: string; aside?: ReactNode; fill?: boolean; children: ReactNode }) {
  return (
    <section className={`card min-w-0 overflow-hidden ${fill ? 'flex flex-col' : ''}`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {aside}
      </div>
      <div className={fill ? 'flex flex-1 flex-col p-4' : 'p-4'}>{children}</div>
    </section>
  )
}
