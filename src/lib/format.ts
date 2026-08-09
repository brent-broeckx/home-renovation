/** Formatting helpers. Currency is EUR, dates are Belgian (nl-BE) by default. */

export const DEFAULT_LOCALE = 'nl-BE'
export const DEFAULT_CURRENCY = 'EUR'

export function formatCurrency(
  value: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  const amount = Number.isFinite(value) ? Number(value) : 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Compact form for tight mobile layouts, still with 2 decimals. */
export function formatNumber(
  value: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  const amount = Number.isFinite(value) ? Number(value) : 0
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(
  value: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  const amount = Number.isFinite(value) ? Number(value) : 0
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)}%`
}

/** `2025-04-08` -> `08/04/2025` */
export function formatDate(
  isoDate: string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!isoDate) return '—'
  const date = parseDateOnly(isoDate)
  if (!date) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Parses a `YYYY-MM-DD` date column into a local-midnight Date, avoiding the
 * UTC shift you get from `new Date('2025-04-08')`.
 */
export function parseDateOnly(isoDate: string | null | undefined): Date | null {
  if (!isoDate) return null
  const [datePart] = isoDate.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

/** Today at local midnight - the reference point for all deadline maths. */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Whole days from today until `isoDate`. Negative when overdue. */
export function daysUntil(isoDate: string | null | undefined): number | null {
  const target = parseDateOnly(isoDate)
  if (!target) return null
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((target.getTime() - startOfToday().getTime()) / msPerDay)
}

/** `Date` -> `YYYY-MM-DD` for writing back to a `date` column. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Rounds to cents so repeated percentage maths never drifts. */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseAmountInput(raw: string): number {
  if (!raw.trim()) return 0
  // Accept both "1.234,56" and "1234.56"
  const normalised = raw
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalised)
  return Number.isFinite(parsed) ? roundCents(parsed) : 0
}
