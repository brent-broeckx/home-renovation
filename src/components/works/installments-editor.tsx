import { useState } from 'react'
import { Landmark, Percent, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { MoneyInput } from '#/components/money-input'
import { StatusToggle } from '#/components/status-toggle'
import { formatCurrency, roundCents } from '#/lib/format'
import { cn } from '#/lib/utils'
import type {
  FundingSource,
  InstallmentRow,
  SettingsRow,
} from '#/lib/database.types'

/** Common Belgian contractor schedules, one click away. */
const PRESETS: Array<{
  label: string
  parts: Array<{ label: string; percentage: number }>
}> = [
  {
    label: '30 / 40 / 30',
    parts: [
      { label: 'Voorschot', percentage: 30 },
      { label: 'Tijdens werken', percentage: 40 },
      { label: 'Oplevering', percentage: 30 },
    ],
  },
  {
    label: '50 / 50',
    parts: [
      { label: 'Voorschot', percentage: 50 },
      { label: 'Oplevering', percentage: 50 },
    ],
  },
]

interface InstallmentsEditorProps {
  installments: Array<InstallmentRow>
  /** Parent line item total incl. VAT - the base for percentages. */
  total: number
  settings: SettingsRow
  disabled: boolean
  onSave: (values: Partial<InstallmentRow>) => void
  onDelete: (id: string) => void
  onAddMany: (
    parts: Array<{ label: string; percentage: number; amount: number }>,
  ) => void
}

export function InstallmentsEditor({
  installments,
  total,
  settings,
  disabled,
  onSave,
  onDelete,
  onAddMany,
}: InstallmentsEditorProps) {
  const [busy, setBusy] = useState(false)

  const sum = roundCents(
    installments.reduce((acc, inst) => acc + Number(inst.amount), 0),
  )
  const mismatch = installments.length > 0 && Math.abs(sum - total) >= 0.01

  function addPreset(parts: Array<{ label: string; percentage: number }>) {
    setBusy(true)
    onAddMany(
      parts.map((part) => ({
        ...part,
        amount: roundCents((total * part.percentage) / 100),
      })),
    )
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      {installments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nog geen schijven. Zodra je schijven toevoegt, nemen ze de knoppen
          &quot;Bank&quot; en &quot;Betaald&quot; van deze regel over: elke
          schijf kiest apart tussen lening/eigen geld, bankaanvraag en betaald.
        </p>
      ) : null}

      <div className="space-y-2">
        {installments.map((inst) => (
          <div
            key={inst.id}
            className={cn(
              'space-y-2 rounded-md border bg-background p-2',
              inst.paid && 'border-emerald-200 bg-emerald-50/40',
            )}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.5fr)_5rem_8rem_9.5rem]">
              <Input
                className="col-span-2 h-8 sm:col-span-1"
                value={inst.label}
                disabled={disabled}
                placeholder="Label"
                onChange={(event) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    label: event.target.value,
                  })
                }
              />

              <div className="relative">
                <Input
                  className="tabular h-8 pr-6 text-right"
                  inputMode="decimal"
                  disabled={disabled}
                  placeholder="%"
                  value={inst.percentage ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value
                    const percentage =
                      raw === '' ? null : Number(raw.replace(',', '.'))
                    onSave({
                      id: inst.id,
                      line_item_id: inst.line_item_id,
                      percentage,
                      amount:
                        percentage === null || Number.isNaN(percentage)
                          ? Number(inst.amount)
                          : roundCents((total * percentage) / 100),
                    })
                  }}
                />
                <Percent className="pointer-events-none absolute right-1.5 top-2 size-3.5 text-muted-foreground" />
              </div>

              <MoneyInput
                className="h-8"
                value={Number(inst.amount)}
                disabled={disabled}
                onCommit={(amount) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    amount,
                    percentage: null,
                  })
                }
              />

              <Input
                type="date"
                className="col-span-2 h-8 sm:col-span-1"
                disabled={disabled}
                value={inst.due_date ?? ''}
                onChange={(event) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    due_date: event.target.value || null,
                  })
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <SourceSwitch
                value={inst.source}
                disabled={disabled}
                onChange={(source) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    source,
                    requested_from_bank:
                      source === 'own' ? false : inst.requested_from_bank,
                  })
                }
              />
              <StatusToggle
                icon={Landmark}
                label="Bank"
                tone="violet"
                active={inst.source === 'loan' && inst.requested_from_bank}
                disabled={disabled || inst.source === 'own'}
                onToggle={(next) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    requested_from_bank: next,
                  })
                }
              />
              <StatusToggle
                icon={Wallet}
                label="Betaald"
                tone="green"
                active={inst.paid}
                disabled={disabled}
                onToggle={(next) =>
                  onSave({
                    id: inst.id,
                    line_item_id: inst.line_item_id,
                    paid: next,
                  })
                }
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() => onDelete(inst.id)}
                title="Schijf verwijderen"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => addPreset([{ label: 'Schijf', percentage: 0 }])}
        >
          <Plus className="size-4" />
          Schijf
        </Button>
        {installments.length === 0
          ? PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || busy || total <= 0}
                onClick={() => addPreset(preset.parts)}
              >
                {preset.label}
              </Button>
            ))
          : null}

        {installments.length > 0 ? (
          <span
            className={cn(
              'tabular ml-auto text-xs',
              mismatch ? 'font-medium text-amber-700' : 'text-muted-foreground',
            )}
          >
            Som {formatCurrency(sum, settings.locale, settings.currency)} /{' '}
            {formatCurrency(total, settings.locale, settings.currency)}
            {mismatch ? ' — wijkt af' : ''}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SourceSwitch({
  value,
  disabled,
  onChange,
}: {
  value: FundingSource
  disabled: boolean
  onChange: (value: FundingSource) => void
}) {
  return (
    <div className="inline-flex h-8 shrink-0 overflow-hidden rounded-full border text-xs font-medium">
      {(['loan', 'own'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'px-2.5 transition-colors disabled:cursor-not-allowed',
            value === option
              ? option === 'loan'
                ? 'bg-primary text-primary-foreground'
                : 'bg-indigo-500 text-white'
              : 'bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          {option === 'loan' ? 'Lening' : 'Eigen'}
        </button>
      ))}
    </div>
  )
}
