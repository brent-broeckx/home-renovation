import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { MoneyInput } from '#/components/money-input'
import {
  DEFAULT_SETTINGS,
  useDeleteSupplier,
  useSaveSupplier,
  useSettings,
  useSuppliers,
  useUpdateSettings,
} from '#/lib/api'
import { formatCurrency } from '#/lib/format'
import type { SettingsRow, SupplierRow } from '#/lib/database.types'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  const settingsQuery = useSettings()
  const updateSettings = useUpdateSettings()
  const suppliersQuery = useSuppliers()
  const saveSupplier = useSaveSupplier()
  const deleteSupplier = useDeleteSupplier()

  const [supplierDialog, setSupplierDialog] = useState<
    SupplierRow | 'new' | null
  >(null)

  const settings: SettingsRow =
    settingsQuery.data ??
    ({
      ...DEFAULT_SETTINGS,
      user_id: '',
      created_at: '',
      updated_at: '',
    })
  const suppliers = suppliersQuery.data ?? []

  const [vatDraft, setVatDraft] = useState('')
  useEffect(() => {
    setVatDraft(settings.vat_rates.join(', '))
  }, [settings.vat_rates])

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  function patch(values: Partial<SettingsRow>) {
    updateSettings.mutate(values)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>
        <p className="text-sm text-muted-foreground">
          Budget, btw-tarieven en leveranciers. Wijzigingen worden meteen
          bewaard.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Budget --------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget</CardTitle>
            <CardDescription>
              De renovatielening is één vast bedrag dat vooraf beschikbaar is.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loan">Renovatielening (totaal)</Label>
              <MoneyInput
                id="loan"
                value={Number(settings.loan_amount)}
                onCommit={(value) => patch({ loan_amount: value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="own">Eigen inbreng</Label>
              <MoneyInput
                id="own"
                value={Number(settings.own_contribution)}
                onCommit={(value) => patch({ own_contribution: value })}
              />
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Totaal budget</span>
                <span className="tabular font-semibold">
                  {formatCurrency(
                    Number(settings.loan_amount) +
                      Number(settings.own_contribution),
                    settings.locale,
                    settings.currency,
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voorkeuren</CardTitle>
            <CardDescription>
              Btw, waarschuwingstermijn en notatie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vat-default">Standaard btw-tarief (%)</Label>
                <Input
                  id="vat-default"
                  inputMode="decimal"
                  className="tabular"
                  defaultValue={String(settings.default_vat_rate)}
                  onBlur={(event) => {
                    const value = Number(event.target.value.replace(',', '.'))
                    if (Number.isFinite(value))
                      patch({ default_vat_rate: value })
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warning-days">
                  Waarschuwing vervaldatum (dagen)
                </Label>
                <Input
                  id="warning-days"
                  type="number"
                  min={1}
                  max={365}
                  className="tabular"
                  defaultValue={settings.deadline_warning_days}
                  onBlur={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value) && value >= 1) {
                      patch({ deadline_warning_days: Math.round(value) })
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vat-rates">Beschikbare btw-tarieven</Label>
              <Input
                id="vat-rates"
                className="tabular"
                value={vatDraft}
                placeholder="6, 21"
                onChange={(event) => setVatDraft(event.target.value)}
                onBlur={() => {
                  const rates = vatDraft
                    .split(',')
                    .map((part) => Number(part.trim().replace(',', '.')))
                    .filter(
                      (value) =>
                        Number.isFinite(value) && value >= 0 && value <= 100,
                    )
                  patch({
                    vat_rates: Array.from(new Set(rates)).sort((a, b) => a - b),
                  })
                }}
              />
              <p className="text-xs text-muted-foreground">
                Komma-gescheiden, bv. Belgische BTW: 6, 21.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Munteenheid</Label>
                <Input
                  id="currency"
                  defaultValue={settings.currency}
                  onBlur={(event) => {
                    const value = event.target.value.trim().toUpperCase()
                    if (value.length === 3) patch({ currency: value })
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="locale">Notatie (locale)</Label>
                <Input
                  id="locale"
                  defaultValue={settings.locale}
                  placeholder="nl-BE"
                  onBlur={(event) => {
                    const value = event.target.value.trim()
                    if (value) patch({ locale: value })
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers -------------------------------------------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Leveranciers &amp; aannemers
            </CardTitle>
            <CardDescription>
              Koppel deze aan regels op de werkenpagina.
            </CardDescription>
          </div>
          <Button onClick={() => setSupplierDialog('new')}>
            <Plus className="size-4" />
            Toevoegen
          </Button>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nog geen leveranciers toegevoegd.
            </p>
          ) : (
            <ul className="divide-y">
              {suppliers.map((supplier) => (
                <li
                  key={supplier.id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {supplier.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[supplier.contact_name, supplier.email, supplier.phone]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    {supplier.notes ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {supplier.notes}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setSupplierDialog(supplier)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`"${supplier.name}" verwijderen?`)) {
                        deleteSupplier.mutate(supplier.id)
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SupplierDialog
        supplier={supplierDialog}
        onClose={() => setSupplierDialog(null)}
        saving={saveSupplier.isPending}
        onSave={async (values) => {
          await saveSupplier.mutateAsync(values)
          setSupplierDialog(null)
        }}
      />
    </div>
  )
}

function SupplierDialog({
  supplier,
  onClose,
  onSave,
  saving,
}: {
  supplier: SupplierRow | 'new' | null
  onClose: () => void
  onSave: (values: Partial<SupplierRow> & { name: string }) => Promise<void>
  saving: boolean
}) {
  const existing = supplier === 'new' || supplier === null ? null : supplier
  const [draft, setDraft] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  })

  useEffect(() => {
    setDraft({
      name: existing?.name ?? '',
      contact_name: existing?.contact_name ?? '',
      email: existing?.email ?? '',
      phone: existing?.phone ?? '',
      website: existing?.website ?? '',
      notes: existing?.notes ?? '',
    })
  }, [existing])

  return (
    <Dialog
      open={supplier !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Leverancier bewerken' : 'Nieuwe leverancier'}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3 py-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draft.name.trim()) return
            void onSave({
              id: existing?.id,
              name: draft.name.trim(),
              contact_name: draft.contact_name.trim() || null,
              email: draft.email.trim() || null,
              phone: draft.phone.trim() || null,
              website: draft.website.trim() || null,
              notes: draft.notes.trim() || null,
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="supplier-name">Naam</Label>
            <Input
              id="supplier-name"
              required
              autoFocus
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-contact">Contactpersoon</Label>
              <Input
                id="supplier-contact"
                value={draft.contact_name}
                onChange={(event) =>
                  setDraft({ ...draft, contact_name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">Telefoon</Label>
              <Input
                id="supplier-phone"
                type="tel"
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: event.target.value })
                }
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">E-mail</Label>
              <Input
                id="supplier-email"
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-website">Website</Label>
              <Input
                id="supplier-website"
                type="url"
                value={draft.website}
                onChange={(event) =>
                  setDraft({ ...draft, website: event.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-notes">Notities</Label>
            <Textarea
              id="supplier-notes"
              rows={3}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
