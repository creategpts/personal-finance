import Money from './Money'
import InfoHint from './InfoHint'

interface Props {
  label: string
  value: number
  accent?: string
  onClick?: () => void
  blurred?: boolean
  info?: string
}

export default function StatTile({ label, value, accent, onClick, blurred, info }: Props) {
  const Container = onClick ? 'button' : 'div'
  return (
    <Container
      onClick={onClick}
      className={`card block w-full overflow-hidden p-5 ${
        onClick ? 'text-left transition hover:border-faint hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : ''
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-medium text-muted">{label}</span>
        {info && <InfoHint text={info} />}
      </div>
      <div
        className={`mt-2 break-words text-2xl font-semibold tracking-tight text-fg ${
          blurred ? 'select-none blur-sm' : ''
        }`}
        style={accent ? { color: accent } : undefined}
      >
        <Money value={value} />
      </div>
    </Container>
  )
}
