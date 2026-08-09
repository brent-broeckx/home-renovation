import type { Balance } from '#/lib/calculations'
import { formatCurrency } from '#/lib/format'
import { cn } from '#/lib/utils'

interface BalanceMeterProps {
  title: string
  subtitle?: string
  balance: Balance
  /** Colour of the consumed portion. */
  tone?: 'primary' | 'emerald' | 'amber' | 'slate'
  locale: string
  currency: string
  className?: string
}

const BAR_TONE: Record<NonNullable<BalanceMeterProps['tone']>, string> = {
  primary: 'bg-primary',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
}

export function BalanceMeter({
  title,
  subtitle,
  balance,
  tone = 'primary',
  locale,
  currency,
  className,
}: BalanceMeterProps) {
  const overspent = balance.remaining < 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <p
          className={cn(
            'tabular text-lg font-semibold tracking-tight',
            overspent ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatCurrency(balance.remaining, locale, currency)}
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            overspent ? 'bg-destructive' : BAR_TONE[tone],
          )}
          style={{ width: `${Math.round(balance.ratio * 100)}%` }}
        />
      </div>

      <div className="tabular flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(balance.used, locale, currency)} gebruikt</span>
        <span>van {formatCurrency(balance.capacity, locale, currency)}</span>
      </div>
    </div>
  )
}
