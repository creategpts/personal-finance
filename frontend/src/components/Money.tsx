const fmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function Money({ value, className }: { value: number; className?: string }) {
  return <span className={`num ${className ?? ''}`}>{fmt.format(value)}</span>
}
