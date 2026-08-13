import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type Mode = 'month' | 'quarter' | 'year' | 'range'

const MODES: [Mode, string][] = [
  ['month', 'Mes'],
  ['quarter', 'Trimestre'],
  ['year', 'Año'],
  ['range', 'Fechas'],
]

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const monthRange = (year: number, month: number): [string, string] => [
  fmt(new Date(year, month - 1, 1)),
  fmt(new Date(year, month, 0)),
]
const quarterRange = (year: number, quarter: number): [string, string] => {
  const start = (quarter - 1) * 3 + 1
  return [fmt(new Date(year, start - 1, 1)), fmt(new Date(year, start + 2, 0))]
}
const yearRange = (year: number): [string, string] => [fmt(new Date(year, 0, 1)), fmt(new Date(year, 11, 31))]

interface Props {
  onChange: (from: string, to: string) => void
  // seed the selector from an existing range (e.g. a drill-down link) instead of
  // defaulting to the current month. Only read on mount — pass a `key` on the
  // component if the caller needs it to react to a later change.
  initialFrom?: string
  initialTo?: string
}

// borderless select/date that blends into its box (the box sets the height);
// appearance-none drops the native dropdown caret — the box itself already looks clickable
const bareSelect = 'cursor-pointer appearance-none border-0 bg-transparent text-sm font-medium text-fg focus:outline-none'
const bareDate = 'cursor-pointer border-0 bg-transparent text-sm text-fg focus:outline-none'
const arrowBtn = 'flex items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-30'

export default function PeriodSelector({ onChange, initialFrom, initialTo }: Props) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  // an initial range that exactly matches a calendar month starts in Mes mode
  // pointed at it; any other initial range starts in Fechas mode with those dates.
  let seededMode: Mode = 'month'
  let seededYear = currentYear
  let seededMonth = now.getMonth() + 1
  if (initialFrom && initialTo) {
    const y = Number(initialFrom.split('-')[0])
    const m = Number(initialFrom.split('-')[1])
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const [mrFrom, mrTo] = monthRange(y, m)
      if (mrFrom === initialFrom && mrTo === initialTo) {
        seededYear = y
        seededMonth = m
      } else {
        seededMode = 'range'
      }
    }
  }

  const [mode, setMode] = useState<Mode>(seededMode)
  const [year, setYear] = useState(seededYear)
  const [month, setMonth] = useState(seededMonth)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [rangeFrom, setRangeFrom] = useState(initialFrom ?? fmt(now))
  const [rangeTo, setRangeTo] = useState(initialTo ?? fmt(now))

  useEffect(() => {
    const [from, to] =
      mode === 'month' ? monthRange(year, month) :
      mode === 'quarter' ? quarterRange(year, quarter) :
      mode === 'year' ? yearRange(year) :
      [rangeFrom, rangeTo]
    onChange(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, month, quarter, rangeFrom, rangeTo])

  // step to previous/next period (month/quarter/year), rolling the year over
  function step(delta: number) {
    if (mode === 'month') {
      let m = month + delta
      let y = year
      while (m < 1) { m += 12; y -= 1 }
      while (m > 12) { m -= 12; y += 1 }
      setMonth(m)
      setYear(y)
    } else if (mode === 'quarter') {
      let q = quarter + delta
      let y = year
      while (q < 1) { q += 4; y -= 1 }
      while (q > 4) { q -= 4; y += 1 }
      setQuarter(q)
      setYear(y)
    } else if (mode === 'year') {
      setYear(year + delta)
    }
  }

  function goToday() {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setQuarter(Math.floor(d.getMonth() / 3) + 1)
    setRangeFrom(fmt(d))
    setRangeTo(fmt(d))
  }

  const stepDisabled = mode === 'range'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* mode: segmented control */}
      <div className="flex h-9 items-center gap-0.5 rounded-lg border border-line bg-surface px-1 text-sm">
        {MODES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`flex h-7 items-center rounded-md px-3 font-medium transition-colors ${
              mode === key ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* prev arrow — outside the value box */}
      <button type="button" onClick={() => step(-1)} disabled={stepDisabled} aria-label="Periodo anterior" className={arrowBtn}>
        <ChevronLeftIcon width={22} height={22} />
      </button>

      {/* value box */}
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3">
        {mode === 'month' && (
          <select className={bareSelect} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        )}
        {mode === 'quarter' && (
          <select className={bareSelect} value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>T{q}</option>
            ))}
          </select>
        )}
        {mode === 'range' ? (
          <>
            <input type="date" className={bareDate} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            <span className="text-faint">–</span>
            <input type="date" className={bareDate} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </>
        ) : (
          <select className={bareSelect} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {/* next arrow — outside the value box */}
      <button type="button" onClick={() => step(1)} disabled={stepDisabled} aria-label="Periodo siguiente" className={arrowBtn}>
        <ChevronRightIcon width={22} height={22} />
      </button>

      <button
        type="button"
        onClick={goToday}
        className="flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-muted transition-colors hover:text-fg"
      >
        Hoy
      </button>
    </div>
  )
}
