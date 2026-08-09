import { useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  EyeOff,
  FileText,
  Landmark,
  Layers,
  Link2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plug,
  ReceiptEuro,
  Send,
  Trash2,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { StatusToggle } from '#/components/status-toggle'
import { CommentsSection } from '#/components/works/comments-section'
import { InstallmentsEditor } from '#/components/works/installments-editor'
import { cn } from '#/lib/utils'
import { daysUntil, formatCurrency, formatDate } from '#/lib/format'
import type { LineItemCalc } from '#/lib/calculations'
import type {
  FundingSource,
  InstallmentRow,
  LineItem,
  LineItemRow as LineItemRowType,
  SettingsRow,
  SupplierRow,
} from '#/lib/database.types'

interface LineItemRowProps {
  item: LineItem
  calc: LineItemCalc
  supplier: SupplierRow | undefined
  settings: SettingsRow
  onPatch: (patch: Partial<LineItemRowType>) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSaveInstallment: (values: Partial<InstallmentRow>) => void
  onDeleteInstallment: (id: string) => void
  onAddInstallments: (
    parts: Array<{ label: string; percentage: number; amount: number }>,
  ) => void
  onAddComment: (body: string) => void
  onDeleteComment: (id: string) => void
}

export function LineItemRow({
  item,
  calc,
  supplier,
  settings,
  onPatch,
  onEdit,
  onDuplicate,
  onDelete,
  onSaveInstallment,
  onDeleteInstallment,
  onAddInstallments,
  onAddComment,
  onDeleteComment,
}: LineItemRowProps) {
  const [openPanel, setOpenPanel] = useState<
    'comments' | 'installments' | null
  >(null)
  const isWork = item.type === 'work'
  const TypeIcon = isWork ? Wrench : Plug
  const money = (value: number) =>
    formatCurrency(value, settings.locale, settings.currency)

  return (
    <li
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-opacity',
        item.disabled && 'opacity-55 grayscale',
        calc.isPaid && !item.disabled && 'border-emerald-200',
      )}
    >
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-4">
        {/* Identity ------------------------------------------------ */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            title={isWork ? 'Verbouwwerk' : 'Aanvraag / aansluiting'}
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              isWork
                ? 'bg-slate-100 text-slate-700'
                : 'bg-teal-100 text-teal-700',
            )}
          >
            <TypeIcon className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={onEdit}
                className={cn(
                  'truncate text-left text-sm font-semibold hover:underline',
                  item.disabled && 'line-through',
                )}
              >
                {item.description}
              </button>
              {item.attachment_url ? (
                <a
                  href={item.attachment_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Document openen"
                  className="text-muted-foreground hover:text-primary"
                >
                  <Link2 className="size-4" />
                </a>
              ) : null}
              {item.disabled ? (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <EyeOff className="size-3" /> Uitgeschakeld
                </Badge>
              ) : null}
              {calc.installmentMismatch ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                  title="De som van de schijven wijkt af van het totaal"
                >
                  <AlertTriangle className="size-3" /> Schijven ≠ totaal
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">
                {supplier?.name ?? 'Geen leverancier'}
              </span>
              {item.due_date && !calc.hasInstallments ? (
                <DueBadge
                  dueDate={item.due_date}
                  paid={calc.isPaid}
                  locale={settings.locale}
                />
              ) : null}
              {calc.hasInstallments ? (
                <span className="tabular">
                  {calc.installmentPaidTotal > 0
                    ? `${money(calc.installmentPaidTotal)} van ${money(calc.installmentTotal)} betaald`
                    : `${item.installments.length} schijven`}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Amounts ------------------------------------------------- */}
        <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
          <div className="text-right">
            <p className="tabular text-sm font-semibold">{money(calc.total)}</p>
            <p className="tabular text-[11px] text-muted-foreground">
              {money(Number(item.amount_excl_vat))} excl. ·{' '}
              {Number(item.vat_rate)}%
            </p>
          </div>

          {calc.hasInstallments ? (
            <span
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-muted px-2.5 text-xs font-medium text-muted-foreground"
              title="Per schijf kiezen tussen lening en eigen geld"
            >
              <Layers className="size-3.5" />
              Schijven
            </span>
          ) : (
            <SourceSwitch
              value={item.source}
              disabled={item.disabled}
              onChange={(source) => onPatch({ source })}
            />
          )}
        </div>

        {/* Statuses ------------------------------------------------ */}
        <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0">
          {!isWork ? (
            <StatusToggle
              icon={Send}
              label="Aangevraagd"
              tone="teal"
              compact
              active={item.request_submitted}
              disabled={item.disabled}
              onToggle={(next) => onPatch({ request_submitted: next })}
            />
          ) : null}
          <StatusToggle
            icon={FileText}
            label="Offerte"
            tone="amber"
            compact
            active={item.offer_received}
            disabled={item.disabled}
            onToggle={(next) => onPatch({ offer_received: next })}
          />
          <StatusToggle
            icon={ReceiptEuro}
            label="Factuur"
            tone="blue"
            compact
            active={item.invoice_received}
            disabled={item.disabled}
            onToggle={(next) => onPatch({ invoice_received: next })}
          />
          <StatusToggle
            icon={Landmark}
            label={calc.hasInstallments ? 'Schijven' : 'Bank'}
            tone="violet"
            compact
            active={calc.isRequestedFromBank}
            disabled={item.disabled || calc.hasInstallments}
            onToggle={(next) => onPatch({ requested_from_bank: next })}
          />
          <StatusToggle
            icon={Wallet}
            label={calc.hasInstallments ? 'Schijven' : 'Betaald'}
            tone="green"
            compact
            active={calc.isPaid}
            disabled={item.disabled || calc.hasInstallments}
            onToggle={(next) => onPatch({ paid: next })}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" /> Bewerken
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="size-4" /> Dupliceren
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onPatch({ disabled: !item.disabled })}
              >
                <EyeOff className="size-4" />
                {item.disabled ? 'Weer meetellen' : 'Uitschakelen'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Collapsible panels ---------------------------------------- */}
      <div className="flex flex-wrap gap-1 border-t px-3 py-1.5">
        <Collapsible
          open={openPanel === 'comments'}
          onOpenChange={(open) => setOpenPanel(open ? 'comments' : null)}
          className="w-full"
        >
          <div className="flex flex-wrap gap-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <MessageSquare className="size-3.5" />
                Opmerkingen ({item.comments.length})
              </Button>
            </CollapsibleTrigger>

            {isWork ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setOpenPanel((current) =>
                    current === 'installments' ? null : 'installments',
                  )
                }
              >
                <Layers className="size-3.5" />
                Schijven ({item.installments.length})
              </Button>
            ) : null}
          </div>

          <CollapsibleContent className="pb-3 pt-2">
            <CommentsSection
              comments={item.comments}
              settings={settings}
              onAdd={onAddComment}
              onDelete={onDeleteComment}
            />
          </CollapsibleContent>
        </Collapsible>

        {openPanel === 'installments' && isWork ? (
          <div className="w-full pb-3 pt-2">
            <InstallmentsEditor
              installments={item.installments}
              total={calc.total}
              settings={settings}
              disabled={item.disabled}
              onSave={(values) =>
                onSaveInstallment({ ...values, line_item_id: item.id })
              }
              onDelete={onDeleteInstallment}
              onAddMany={onAddInstallments}
            />
          </div>
        ) : null}
      </div>
    </li>
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

function DueBadge({
  dueDate,
  paid,
  locale,
}: {
  dueDate: string
  paid: boolean
  locale: string
}) {
  const days = daysUntil(dueDate)
  if (days === null) return null

  const tone = paid
    ? 'border-border text-muted-foreground'
    : days < 0
      ? 'border-red-300 bg-red-50 text-red-700'
      : days <= 7
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-border text-muted-foreground'

  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px]', tone)}>
      <CalendarClock className="size-3" />
      {formatDate(dueDate, locale)}
      {!paid && days < 0 ? ` (${Math.abs(days)}d te laat)` : null}
      {!paid && days >= 0 && days <= 14 ? ` (${days}d)` : null}
    </Badge>
  )
}
