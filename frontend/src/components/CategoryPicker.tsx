import { useEffect, useRef, useState } from 'react'

export interface PickerLeaf {
  value: string
  label: string
}
export interface PickerGroup {
  label: string
  selfValue?: string // if set, the group itself is also a valid pick ("General (sin subcategoría)")
  children: PickerLeaf[]
  // true for a grouping that exists only to declutter the top level (e.g. "Cuenta"
  // bundling every account) — its children are peers, not real subcategories, so no
  // "·" connector when listing them.
  flat?: boolean
}
export type PickerItem = ({ kind: 'leaf' } & PickerLeaf) | ({ kind: 'group' } & PickerGroup)

function labelFor(items: PickerItem[], value: string): string {
  for (const it of items) {
    if (it.kind === 'leaf' && it.value === value) return it.label
    if (it.kind === 'group') {
      if (it.selfValue === value) return it.label
      const child = it.children.find((c) => c.value === value)
      if (child) return child.label
    }
  }
  return value
}

// true when `value` is a group's own pick (e.g. "Vivienda" itself, as opposed to one
// of its subcategories) — that's the only case worth badging, so the user can tell
// "the category itself" apart from "a subcategory of it" at a glance.
function isGroupSelf(items: PickerItem[], value: string): boolean {
  return items.some((it) => it.kind === 'group' && it.selfValue === value)
}

function PrincipalBadge() {
  return (
    <span className="shrink-0 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
      General
    </span>
  )
}

const row = 'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-fg transition hover:bg-surface2'

// Two-level select: first click on a leaf picks it directly; first click on a group
// (e.g. "Cuenta", or a category with subcategories) drills into a second list — a
// second click there makes the final pick. Native <select>/<optgroup> can't do this
// (an optgroup label isn't itself a clickable step), hence a custom popover.
export default function CategoryPicker({
  items,
  value,
  onChange,
}: {
  items: PickerItem[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<PickerGroup | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveGroup(null)
      }
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [open])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setActiveGroup(null)
  }

  // when the group is the ONLY top-level option (e.g. "Cuenta" is all there is to
  // pick from), drilling into it first adds a click for no reason — show its
  // members right away instead.
  const soleGroup = items.length === 1 && items[0].kind === 'group' ? items[0] : null

  function groupRows(group: PickerGroup) {
    return (
      <>
        {group.selfValue && (
          <button type="button" onClick={() => pick(group.selfValue as string)} className={row}>
            <span>{group.label}</span>
            <PrincipalBadge />
          </button>
        )}
        {group.children.map((c) =>
          group.flat ? (
            <button key={c.value} type="button" onClick={() => pick(c.value)} className={row}>
              {c.label}
            </button>
          ) : (
            <button key={c.value} type="button" onClick={() => pick(c.value)} className={`${row} gap-2`}>
              <span className="text-faint">·</span>
              <span className="flex-1">{c.label}</span>
            </button>
          ),
        )}
      </>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          ;(document.activeElement as HTMLElement | null)?.blur() // drop the mobile keyboard
          setOpen((o) => !o)
          setActiveGroup(null)
        }}
        className="input flex w-full items-center justify-between text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{labelFor(items, value)}</span>
          {isGroupSelf(items, value) && <PrincipalBadge />}
        </span>
        <span className="ml-2 shrink-0 text-faint">▾</span>
      </button>
      {open && (
        // mobile: bottom sheet (fixed) so it can't be clipped by the modal or hidden
        // behind the on-screen keyboard/body scroll-lock; desktop: popover under the button.
        <div className="fixed inset-x-3 bottom-3 z-[60] max-h-[55vh] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:z-30 sm:mt-1 sm:max-h-64 sm:w-full sm:rounded-lg sm:shadow-lg">
          {activeGroup ? (
            groupRows(activeGroup)
          ) : soleGroup ? (
            groupRows(soleGroup)
          ) : (
            items.map((it, i) =>
              it.kind === 'leaf' ? (
                <button key={it.value} type="button" onClick={() => pick(it.value)} className={row}>
                  {it.label}
                </button>
              ) : (
                <button key={`g-${i}`} type="button" onClick={() => setActiveGroup(it)} className={row}>
                  <span>{it.label}</span>
                  <span className="text-faint">›</span>
                </button>
              ),
            )
          )}
        </div>
      )}
    </div>
  )
}
