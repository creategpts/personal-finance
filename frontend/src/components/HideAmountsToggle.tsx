import { useHideAmounts, toggleHideAmounts } from '../hideAmounts'

export default function HideAmountsToggle() {
  const hideAmounts = useHideAmounts()

  return (
    <button
      onClick={() => toggleHideAmounts()}
      role="switch"
      aria-checked={hideAmounts}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
    >
      Ocultar importes
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          hideAmounts ? 'bg-primary' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition ${
            hideAmounts ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
