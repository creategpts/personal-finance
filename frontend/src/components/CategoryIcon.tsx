import { icons, Tag } from 'lucide-react'

// `icon` stores a lucide-react icon name (e.g. "Utensils"); Tag is the fallback
// for empty/unrecognized names (old data, direct API edits...).
export default function CategoryIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = icons[name as keyof typeof icons] ?? Tag
  return <Icon size={size} className={className} />
}
