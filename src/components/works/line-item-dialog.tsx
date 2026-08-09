import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { MoneyInput } from '#/components/money-input'
import { formatCurrency, roundCents } from '#/lib/format'
import type {
  FundingSource,
  LineItem,
  LineItemRow,
  LineItemType,
  SettingsRow,
  SupplierRow,
} from '#/lib/database.types'

const NO_SUPPLIER = '__none__'

export interface LineItemDraft {
  type: LineItemType
  description: string
  supplier_id: string | null
  amount_excl_vat: number
  vat_rate: number
  source: FundingSource
  due_date: string | null
  attachment_url: string | null
  offer_received: boolean
  invoice_received: boolean
  requested_from_bank: boolean
  paid: boolean
  request_submitted: boolean
  disabled: boolean
}

function toDraft(item: LineItem | null, settings: SettingsRow): LineItemDraft {
  if (!item) {
    return {
      type: 'work',
      description: '',
      supplier_id: null,
      amount_excl_vat: 0,
      vat_rate: Number(settings.default_vat_rate),
      source: 'loan',
      due_date: null,
      attachment_url: null,
      offer_received: false,
      invoice_received: false,
      requested_from_bank: false,
      paid: false,
      request_submitted: false,
      disabled: false,
    }
  }
  return {
    type: item.type,
    description: item.description,
    supplier_id: item.supplier_id,
    amount_excl_vat: Number(item.amount_excl_vat),
    vat_rate: Number(item.vat_rate),
    source: item.source,
    due_date: item.due_date,
    attachment_url: item.attachment_url,
    offer_received: item.offer_received,
    invoice_received: item.invoice_received,
    requested_from_bank: item.requested_from_bank,
    paid: item.paid,
    request_submitted: item.request_submitted,
    disabled: item.disabled,
  }
}

interface LineItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: LineItem | null
  suppliers: Array<SupplierRow>
  settings: SettingsRow
  saving: boolean
  onSave: (values: Partial<LineItemRow>) => void
}

export function LineItemDialog({
  open,
  onOpenChange,
  item,
  suppliers,
  settings,
  saving,
  onSave,
}: LineItemDialogProps) {
  const [draft, setDraft] = useState<LineItemDraft>(() =>
    toDraft(item, settings),
  )

  useEffect(() => {
    if (open) setDraft(toDraft(item, settings))
  }, [open, item, settings])

  const amountIncl = roundCents(
    draft.amount_excl_vat * (1 + draft.vat_rate / 100),
  )

  function patch(next: Partial<LineItemDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.description.trim()) return
    onSave({
      ...draft,
      description: draft.description.trim(),
      attachment_url: draft.attachment_url?.trim() || null,
    })
  }

  const vatOptions = Array.from(
    new Set([
      ...settings.vat_rates.map(Number),
      Number(draft.vat_rate),
    ]),
  ).sort((a, b) => a - b)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Regel bewerken' : 'Nieuwe regel'}</DialogTitle>
          <DialogDescription>
            Werk of aanvraag met bedragen, status en betaaldatum.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  patch({ type: value as LineItemType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Verbouwwerk</SelectItem>
                  <SelectItem value="request">
                    Aanvraag / aansluiting
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Financiering</Label>
              <Select
                value={draft.source}
                onValueChange={(value) =>
                  patch({ source: value as FundingSource })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Lening</SelectItem>
                  <SelectItem value="own">Eigen inbreng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Omschrijving</Label>
            <Input
              id="description"
              required
              autoFocus
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="bv. Chape gelijkvloers"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Leverancier / aannemer</Label>
            <Select
              value={draft.supplier_id ?? NO_SUPPLIER}
              onValueChange={(value) =>
                patch({ supplier_id: value === NO_SUPPLIER ? null : value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Geen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPLIER}>Geen</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="excl">Bedrag excl. btw</Label>
              <MoneyInput
                id="excl"
                value={draft.amount_excl_vat}
                onCommit={(value) => patch({ amount_excl_vat: value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Btw-tarief</Label>
              <Select
                value={String(draft.vat_rate)}
                onValueChange={(value) => patch({ vat_rate: Number(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vatOptions.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>
                      {rate}%
                    </SelectItem>
                  ))}
                  <SelectItem value="0">0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bedrag incl. btw</span>
              <span className="tabular font-semibold">
                {formatCurrency(amountIncl, settings.locale, settings.currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due">Vervaldatum factuur</Label>
              <Input
                id="due"
                type="date"
                value={draft.due_date ?? ''}
                onChange={(event) =>
                  patch({ due_date: event.target.value || null })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attachment">Link naar document</Label>
              <Input
                id="attachment"
                type="url"
                inputMode="url"
                placeholder="OneDrive-link"
                value={draft.attachment_url ?? ''}
                onChange={(event) =>
                  patch({ attachment_url: event.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            {draft.type === 'request' ? (
              <ToggleRow
                label="Aangevraagd"
                hint="Aanvraag ingediend bij de nutsmaatschappij"
                checked={draft.request_submitted}
                onChange={(value) => patch({ request_submitted: value })}
              />
            ) : null}
            <ToggleRow
              label="Offerte ontvangen"
              checked={draft.offer_received}
              onChange={(value) => patch({ offer_received: value })}
            />
            <ToggleRow
              label="Factuur ontvangen"
              checked={draft.invoice_received}
              onChange={(value) => patch({ invoice_received: value })}
            />
            <ToggleRow
              label="Aangevraagd bij bank"
              hint="Genegeerd zodra er schijven zijn ingesteld"
              checked={draft.requested_from_bank}
              onChange={(value) => patch({ requested_from_bank: value })}
            />
            <ToggleRow
              label="Betaald"
              hint="Genegeerd zodra er schijven zijn ingesteld"
              checked={draft.paid}
              onChange={(value) => patch({ paid: value })}
            />
            <ToggleRow
              label="Uitgeschakeld"
              hint="Blijft zichtbaar, telt niet mee in berekeningen"
              checked={draft.disabled}
              onChange={(value) => patch({ disabled: value })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={saving || !draft.description.trim()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-sm">
        {label}
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
