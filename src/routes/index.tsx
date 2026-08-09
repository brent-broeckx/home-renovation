import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CalendarClock,
  CircleCheckBig,
  FlaskConical,
  Landmark,
  Loader2,
  Plug,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { BalanceMeter } from '#/components/balance-meter'
import {
  DEFAULT_SETTINGS,
  useLineItems,
  useSettings,
  useSuppliers,
} from '#/lib/api'
import { calcTotals, upcomingDeadlines } from '#/lib/calculations'
import { formatCurrency, formatDate } from '#/lib/format'
import { cn } from '#/lib/utils'
import type { SettingsRow } from '#/lib/database.types'

export const Route = createFileRoute('/')({ component: DashboardPage })

/** Read-only overview. Every edit happens on the Werken page. */
function DashboardPage() {
  const settingsQuery = useSettings()
  const lineItemsQuery = useLineItems()
  const suppliersQuery = useSuppliers()

  const settings: SettingsRow =
    settingsQuery.data ??
    ({
      ...DEFAULT_SETTINGS,
      user_id: '',
      created_at: '',
      updated_at: '',
    })
  const items = useMemo(() => lineItemsQuery.data ?? [], [lineItemsQuery.data])

  const totals = useMemo(
    () =>
      calcTotals({
        items,
        loanAmount: Number(settings.loan_amount),
        ownContribution: Number(settings.own_contribution),
      }),
    [items, settings.loan_amount, settings.own_contribution],
  )

  const deadlines = useMemo(
    () =>
      upcomingDeadlines(items, Number(settings.deadline_warning_days)),
    [items, settings.deadline_warning_days],
  )

  const supplierById = useMemo(
    () =>
      new Map(
        (suppliersQuery.data ?? []).map((supplier) => [supplier.id, supplier]),
      ),
    [suppliersQuery.data],
  )

  const money = (value: number) =>
    formatCurrency(value, settings.locale, settings.currency)
  const loading = settingsQuery.isLoading || lineItemsQuery.isLoading

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overzicht van je renovatielening en wat er binnenkort vervalt.
        </p>
      </div>

      {/* Headline figures ------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leningcapaciteit"
          value={money(totals.actualLoan.capacity)}
          hint="Totaal beschikbaar krediet"
          icon={Landmark}
        />
        <StatCard
          label="Werkelijk opgenomen"
          value={money(totals.actualLoan.used)}
          hint="Gefactureerd én betaald"
          icon={CircleCheckBig}
          tone="emerald"
        />
        <StatCard
          label="Werkelijk resterend"
          value={money(totals.actualLoan.remaining)}
          hint="Wat vandaag nog vrij is"
          icon={Landmark}
          tone={totals.actualLoan.remaining < 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Gesimuleerd resterend"
          value={money(totals.simulatedLoan.remaining)}
          hint="Als alles op de lijst betaald wordt"
          icon={FlaskConical}
          tone={totals.simulatedLoan.remaining < 0 ? 'red' : 'primary'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Deadlines ------------------------------------------------ */}
        <Card className="order-2 lg:order-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Vervaldata binnen {settings.deadline_warning_days} dagen
            </CardTitle>
            <CardDescription>
              Gesorteerd op urgentie, met de status van de bankaanvraag.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Geen facturen die binnenkort vervallen.
              </p>
            ) : (
              <ul className="divide-y">
                {deadlines.map((entry) => {
                  const TypeIcon = entry.lineItemType === 'work' ? Wrench : Plug
                  return (
                    <li
                      key={entry.key}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md',
                          entry.lineItemType === 'work'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-teal-100 text-teal-700',
                        )}
                      >
                        <TypeIcon className="size-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.lineItemDescription}
                          {entry.installmentLabel ? (
                            <span className="text-muted-foreground">
                              {' '}
                              · {entry.installmentLabel}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {supplierById.get(entry.supplierId ?? '')?.name ??
                            '—'}{' '}
                          · {formatDate(entry.dueDate, settings.locale)}
                        </p>
                      </div>

                      <span className="tabular shrink-0 text-sm font-semibold">
                        {money(entry.amount)}
                      </span>

                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-[10px]',
                          entry.isOverdue
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : entry.daysLeft <= 7
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'text-muted-foreground',
                        )}
                      >
                        {entry.isOverdue
                          ? `${Math.abs(entry.daysLeft)}d te laat`
                          : entry.daysLeft === 0
                            ? 'Vandaag'
                            : `over ${entry.daysLeft}d`}
                      </Badge>

                      {entry.source === 'loan' ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 gap-1 text-[10px]',
                            entry.requestedFromBank
                              ? 'border-violet-300 bg-violet-50 text-violet-800'
                              : 'border-orange-300 bg-orange-50 text-orange-800',
                          )}
                        >
                          {entry.requestedFromBank ? (
                            <Landmark className="size-3" />
                          ) : (
                            <TriangleAlert className="size-3" />
                          )}
                          {entry.requestedFromBank
                            ? 'Aangevraagd bij bank'
                            : 'Nog niet aangevraagd'}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          Eigen inbreng
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Balances ------------------------------------------------- */}
        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CircleCheckBig className="size-4 text-emerald-600" />
                Werkelijk saldo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BalanceMeter
                title="Lening"
                balance={totals.actualLoan}
                tone="emerald"
                locale={settings.locale}
                currency={settings.currency}
              />
              <Separator />
              <BalanceMeter
                title="Eigen inbreng"
                balance={totals.actualOwn}
                tone="slate"
                locale={settings.locale}
                currency={settings.currency}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FlaskConical className="size-4 text-primary" />
                Simulatie
              </CardTitle>
              <CardDescription className="text-xs">
                Alle actieve regels tellen mee, ongeacht status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BalanceMeter
                title="Lening"
                balance={totals.simulatedLoan}
                tone="primary"
                locale={settings.locale}
                currency={settings.currency}
              />
              <Separator />
              <BalanceMeter
                title="Eigen inbreng"
                balance={totals.simulatedOwn}
                tone="amber"
                locale={settings.locale}
                currency={settings.currency}
              />
            </CardContent>
          </Card>

          {totals.totalNotYetRequested > 0 ? (
            <Card className="border-amber-300 bg-amber-50/60">
              <CardContent className="flex items-start gap-2 py-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-medium text-amber-900">
                    {money(totals.totalNotYetRequested)} nog aan te vragen
                  </p>
                  <p className="text-xs text-amber-800">
                    Openstaand bedrag op de lening dat nog niet bij de bank is
                    aangevraagd.
                  </p>
                  <Button
                    asChild
                    variant="link"
                    className="h-auto p-0 text-amber-900"
                  >
                    <Link to="/works">Naar werken &amp; aanvragen</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  icon: typeof Landmark
  tone?: 'default' | 'primary' | 'emerald' | 'red'
}) {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    red: 'text-destructive',
  }[tone]

  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <p
          className={cn(
            'tabular text-xl font-semibold tracking-tight',
            toneClass,
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
