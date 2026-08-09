import { CircleCheckBig, FlaskConical, Info, TriangleAlert } from 'lucide-react'
import { BalanceMeter } from '#/components/balance-meter'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { formatCurrency } from '#/lib/format'
import { cn } from '#/lib/utils'
import type { Totals } from '#/lib/calculations'
import type { SettingsRow } from '#/lib/database.types'

interface CalcPanelProps {
  totals: Totals
  settings: SettingsRow
  className?: string
}

export function CalcPanel({ totals, settings, className }: CalcPanelProps) {
  const money = (value: number) =>
    formatCurrency(value, settings.locale, settings.currency)
  const overSimulated =
    totals.simulatedLoan.remaining < 0 || totals.simulatedOwn.remaining < 0

  return (
    <div className={cn('space-y-4', className)}>
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
            subtitle="Enkel gefactureerd én betaald"
            balance={totals.actualLoan}
            tone="emerald"
            locale={settings.locale}
            currency={settings.currency}
          />
          <Separator />
          <BalanceMeter
            title="Eigen inbreng"
            subtitle="Enkel effectief betaald"
            balance={totals.actualOwn}
            tone="slate"
            locale={settings.locale}
            currency={settings.currency}
          />
        </CardContent>
      </Card>

      <Card className={cn(overSimulated && 'border-destructive/50')}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="size-4 text-primary" />
            Simulatie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="flex gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            Alle actieve regels tellen volledig mee, ook offertes die nog niet
            gefactureerd of betaald zijn.
          </p>

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

          {overSimulated ? (
            <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Je zit boven het beschikbare budget. Verplaats regels naar de
              andere financieringsbron of schakel een offerte uit.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <Row
            label="Totaal actieve regels"
            value={money(totals.totalActive)}
          />
          <Row label="Nog te betalen" value={money(totals.totalOutstanding)} />
          <Row
            label="Nog aan te vragen bij bank"
            value={money(totals.totalNotYetRequested)}
            highlight={totals.totalNotYetRequested > 0}
          />
          <Separator className="my-1" />
          <Row
            label="Regels"
            value={`${totals.activeCount} actief · ${totals.disabledCount} uit`}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn('tabular font-medium', highlight && 'text-amber-700')}
      >
        {value}
      </span>
    </div>
  )
}
