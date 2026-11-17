import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  signed?: boolean
}

export default function DecimalInput({ value, onChange, signed = false, ...rest }: Props) {
  const pattern = signed ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const t = e.target.value.trim()
        if (pattern.test(t)) onChange(t.replace(',', '.'))
      }}
    />
  )
}
