import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/utils'

type Tone = 'amber' | 'blue' | 'violet' | 'green' | 'teal'

const TONES: Record<Tone, { on: string; off: string }> = {
  amber: {
    on: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-150',
    off: 'text-muted-foreground border-border hover:border-amber-300 hover:text-amber-700',
  },
  blue: {
    on: 'bg-sky-100 text-sky-800 border-sky-300',
    off: 'text-muted-foreground border-border hover:border-sky-300 hover:text-sky-700',
  },
  violet: {
    on: 'bg-violet-100 text-violet-800 border-violet-300',
    off: 'text-muted-foreground border-border hover:border-violet-300 hover:text-violet-700',
  },
  green: {
    on: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    off: 'text-muted-foreground border-border hover:border-emerald-300 hover:text-emerald-700',
  },
  teal: {
    on: 'bg-teal-100 text-teal-800 border-teal-300',
    off: 'text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700',
  },
}

interface StatusToggleProps {
  icon: LucideIcon
  label: string
  active: boolean
  tone: Tone
  disabled?: boolean
  /** Hides the text label on small screens to keep rows compact. */
  compact?: boolean
  onToggle: (next: boolean) => void
}

/**
 * One-click status pill. Colour + icon make the state scannable at a glance,
 * and the whole pill is the hit target (comfortable on a phone on-site).
 */
export function StatusToggle({
  icon: Icon,
  label,
  active,
  tone,
  disabled,
  compact,
  onToggle,
}: StatusToggleProps) {
  const styles = TONES[tone]
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={() => onToggle(!active)}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active ? styles.on : cn('bg-background', styles.off),
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className={cn(compact && 'hidden xl:inline')}>{label}</span>
    </button>
  )
}
