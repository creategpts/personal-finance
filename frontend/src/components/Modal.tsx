import { useEffect, type ReactNode } from 'react'

const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

interface Props {
  title: string
  size?: keyof typeof SIZE_CLASS
  onClose: () => void
  onSubmit?: (e: React.FormEvent) => void // presence decides <form> vs plain <div>
  headerAction?: ReactNode // e.g. the primary "Guardar" button, next to the title
  footer?: ReactNode // secondary actions (delete...), in their own bordered row
  bodyClassName?: string
  children: ReactNode
}

// Shared shell for every modal in the app: overlay, sizing, header/body/footer
// structure, Escape-to-close, body-scroll lock. Individual modals only bring
// their fields.
export default function Modal({ title, size = 'md', onClose, onSubmit, headerAction, footer, bodyClassName, children }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const Container = onSubmit ? 'form' : 'div'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Container
        {...(onSubmit ? { onSubmit } : {})}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className={`flex max-h-[85vh] w-full ${SIZE_CLASS[size]} flex-col rounded-2xl border border-line bg-surface shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-linesoft px-5 py-4 sm:px-7 sm:py-5">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {headerAction}
        </div>

        <div className={`min-h-0 flex-1 px-5 py-5 sm:px-7 sm:py-6 ${bodyClassName ?? ''}`}>{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-linesoft px-5 py-4 sm:px-7">
            {footer}
          </div>
        )}
      </Container>
    </div>
  )
}
