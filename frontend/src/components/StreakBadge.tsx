export default function StreakBadge({ streak }: { streak: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        streak > 0 ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'
      }`}
    >
      🔥 {streak}
    </span>
  )
}
