import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent } from '#/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { Label } from '#/components/ui/label'
import { LineItemRow } from '#/components/works/line-item-row'
import { LineItemDialog } from '#/components/works/line-item-dialog'
import { CalcPanel } from '#/components/works/calc-panel'
import {
  DEFAULT_SETTINGS,
  useAddComment,
  useCreateLineItem,
  useDeleteComment,
  useDeleteInstallment,
  useDeleteLineItem,
  useLineItems,
  useSaveInstallment,
  useSettings,
  useSuppliers,
  useUpdateLineItem,
} from '#/lib/api'
import { calcAllLineItems, calcTotals, paymentStatus } from '#/lib/calculations'
import { roundCents } from '#/lib/format'
import type {
  LineItem,
  LineItemRow as LineItemRowType,
  SettingsRow,
} from '#/lib/database.types'

export const Route = createFileRoute('/works')({ component: WorksPage })

type TypeFilter = 'all' | 'work' | 'request'
type StatusFilter = 'all' | 'open' | 'unpaid' | 'unrequested' | 'paid'

function WorksPage() {
  const settingsQuery = useSettings()
  const suppliersQuery = useSuppliers()
  const lineItemsQuery = useLineItems()

  const createLineItem = useCreateLineItem()
  const updateLineItem = useUpdateLineItem()
  const deleteLineItem = useDeleteLineItem()
  const saveInstallment = useSaveInstallment()
  const deleteInstallment = useDeleteInstallment()
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showDisabled, setShowDisabled] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LineItem | null>(null)

  const settings: SettingsRow =
    settingsQuery.data ??
    ({
      ...DEFAULT_SETTINGS,
      user_id: '',
      created_at: '',
      updated_at: '',
    })
  const suppliers = suppliersQuery.data ?? []
  const items = useMemo(() => lineItemsQuery.data ?? [], [lineItemsQuery.data])

  const calcs = useMemo(() => calcAllLineItems(items), [items])
  const totals = useMemo(
    () =>
      calcTotals({
        items,
        loanAmount: Number(settings.loan_amount),
        ownContribution: Number(settings.own_contribution),
      }),
    [items, settings.loan_amount, settings.own_contribution],
  )

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  )

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!showDisabled && item.disabled) return false
      if (typeFilter !== 'all' && item.type !== typeFilter) return false

      if (needle) {
        const supplierName =
          supplierById.get(item.supplier_id ?? '')?.name ?? ''
        const haystack = `${item.description} ${supplierName}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      const calc = calcs.get(item.id)
      if (!calc) return true
      switch (statusFilter) {
        case 'open':
          return paymentStatus(item, calc) === 'open'
        case 'unpaid':
          return !calc.isPaid
        case 'unrequested':
          return (
            !item.requested_from_bank && item.source === 'loan' && !calc.isPaid
          )
        case 'paid':
          return calc.isPaid
        default:
          return true
      }
    })
  }, [
    items,
    search,
    showDisabled,
    typeFilter,
    statusFilter,
    calcs,
    supplierById,
  ])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: LineItem) {
    setEditing(item)
    setDialogOpen(true)
  }

  async function handleSave(values: Partial<LineItemRowType>) {
    if (editing) {
      await updateLineItem.mutateAsync({ id: editing.id, patch: values })
      await syncPercentageInstallments(editing, values)
    } else {
      await createLineItem.mutateAsync({
        ...values,
        description: values.description ?? '',
        sort_order: items.length,
      })
    }
    setDialogOpen(false)
    setEditing(null)
  }

  /** Percentage-based schedules follow the item total when it changes. */
  async function syncPercentageInstallments(
    item: LineItem,
    values: Partial<LineItemRowType>,
  ) {
    const nextExcl = Number(values.amount_excl_vat ?? item.amount_excl_vat)
    const nextRate = Number(values.vat_rate ?? item.vat_rate)
    const nextTotal = roundCents(nextExcl * (1 + nextRate / 100))
    if (Math.abs(nextTotal - Number(item.amount_incl_vat)) < 0.01) return

    await Promise.all(
      item.installments
        .filter((inst) => inst.percentage !== null)
        .map((inst) =>
          saveInstallment.mutateAsync({
            id: inst.id,
            line_item_id: item.id,
            amount: roundCents((nextTotal * Number(inst.percentage)) / 100),
          }),
        ),
    )
  }

  function handleDuplicate(item: LineItem) {
    void createLineItem.mutateAsync({
      type: item.type,
      description: `${item.description} (kopie)`,
      supplier_id: item.supplier_id,
      amount_excl_vat: Number(item.amount_excl_vat),
      vat_rate: Number(item.vat_rate),
      source: item.source,
      due_date: item.due_date,
      attachment_url: item.attachment_url,
      disabled: true,
      sort_order: items.length,
    })
  }

  const loading = settingsQuery.isLoading || lineItemsQuery.isLoading

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Werken &amp; aanvragen
          </h1>
          <p className="text-sm text-muted-foreground">
            Alle verbouwwerken en nutsaanvragen op één lijst.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nieuwe regel
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {/* Filters ------------------------------------------------ */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 py-3">
              <div className="relative min-w-[10rem] flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Zoeken…"
                  className="pl-8"
                />
              </div>

              <Tabs
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
              >
                <TabsList>
                  <TabsTrigger value="all">Alles</TabsTrigger>
                  <TabsTrigger value="work">Werken</TabsTrigger>
                  <TabsTrigger value="request">Aanvragen</TabsTrigger>
                </TabsList>
              </Tabs>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger className="w-[11rem]">
                  <SlidersHorizontal className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="open">Enkel nog niets</SelectItem>
                  <SelectItem value="unpaid">Nog niet betaald</SelectItem>
                  <SelectItem value="unrequested">Nog niet bij bank</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  id="show-disabled"
                  checked={showDisabled}
                  onCheckedChange={setShowDisabled}
                />
                <Label
                  htmlFor="show-disabled"
                  className="text-xs text-muted-foreground"
                >
                  Uitgeschakelde tonen
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Mobile calculation summary ------------------------------ */}
          <CalcPanel
            totals={totals}
            settings={settings}
            className="lg:hidden"
          />

          {/* List --------------------------------------------------- */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibleItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Geen regels gevonden.
                <div className="mt-3">
                  <Button variant="outline" onClick={openCreate}>
                    <Plus className="size-4" />
                    Eerste regel toevoegen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => {
                const calc = calcs.get(item.id)
                if (!calc) return null
                return (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    calc={calc}
                    supplier={supplierById.get(item.supplier_id ?? '')}
                    settings={settings}
                    onPatch={(patch) =>
                      updateLineItem.mutate({ id: item.id, patch })
                    }
                    onEdit={() => openEdit(item)}
                    onDuplicate={() => handleDuplicate(item)}
                    onDelete={() => {
                      if (
                        window.confirm(`"${item.description}" verwijderen?`)
                      ) {
                        deleteLineItem.mutate(item.id)
                      }
                    }}
                    onSaveInstallment={(values) =>
                      saveInstallment.mutate({
                        ...values,
                        line_item_id: item.id,
                      })
                    }
                    onDeleteInstallment={(id) => deleteInstallment.mutate(id)}
                    onAddInstallments={(parts) => {
                      parts.forEach((part, index) => {
                        saveInstallment.mutate({
                          line_item_id: item.id,
                          label: part.label,
                          percentage: part.percentage || null,
                          amount: part.amount,
                          // Inherit the line-item flag the schedule takes over
                          // from, so nothing silently reverts to "not requested".
                          requested_from_bank: item.requested_from_bank,
                          source: item.source,
                          sort_order: item.installments.length + index,
                        })
                      })
                    }}
                    onAddComment={(body) =>
                      addComment.mutate({ lineItemId: item.id, body })
                    }
                    onDeleteComment={(id) => deleteComment.mutate(id)}
                  />
                )
              })}
            </ul>
          )}
        </div>

        {/* Sticky sidebar ------------------------------------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-[4.5rem]">
            <CalcPanel totals={totals} settings={settings} />
          </div>
        </aside>
      </div>

      <LineItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        item={editing}
        suppliers={suppliers}
        settings={settings}
        saving={createLineItem.isPending || updateLineItem.isPending}
        onSave={(values) => void handleSave(values)}
      />
    </div>
  )
}
