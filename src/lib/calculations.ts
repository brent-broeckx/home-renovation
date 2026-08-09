/**
 * Core financial engine.
 *
 * Two independent views on the same list of line items:
 *
 * 1. ACTUAL ("real") - the authoritative state of the loan. Only money that has
 *    genuinely left the account counts: an item must have its invoice received
 *    AND be marked paid. Items with installments configured are the exception -
 *    installments override the top-level `paid` and `requested_from_bank`
 *    flags, so only the *paid* installments count and each installment is
 *    requested from the bank on its own.
 *
 * 2. SIMULATION - forward looking. Every active line item counts in full,
 *    whatever its offer/invoice/requested/paid status, charged against the
 *    balance selected by its `source` (loan or own contribution). With
 *    installments configured, every installment has its own source and the
 *    parent source becomes a summary only. This answers "if I end up paying for
 *    everything on this list, what is left?".
 *
 * Disabled rows are excluded from both, always. Amounts are incl. VAT, because
 * that is what actually gets transferred to the contractor.
 */

import { daysUntil, roundCents } from './format'
import type {
  FundingSource,
  InstallmentRow,
  LineItem,
  LineItemRow,
} from './database.types'

export interface LineItemCalc {
  id: string
  /** Total incl. VAT of the line item itself. */
  total: number
  hasInstallments: boolean
  /** Sum of all installments (paid and unpaid). */
  installmentTotal: number
  /** Sum of the paid installments only. */
  installmentPaidTotal: number
  /** Money that has actually been spent for this item. */
  paidAmount: number
  /** Actually spent from the renovation loan. */
  actualLoanAmount: number
  /** Actually spent from own contribution. */
  actualOwnAmount: number
  /** Money still to be spent for this item. */
  outstandingAmount: number
  /** Amount charged against the simulated balance. */
  simulatedAmount: number
  /** Simulated amount charged against the renovation loan. */
  simulatedLoanAmount: number
  /** Simulated amount charged against own contribution. */
  simulatedOwnAmount: number
  /** Derived paid status - installments win over the top-level flag. */
  isPaid: boolean
  /** Derived bank status - installments win over the top-level flag. */
  isRequestedFromBank: boolean
  /** Loan-funded outstanding money that has not been requested from the bank yet. */
  notRequestedAmount: number
  /** True when installments were configured but do not add up to the total. */
  installmentMismatch: boolean
}

export interface Balance {
  /** Configured starting capital. */
  capacity: number
  /** Amount consumed. */
  used: number
  /** capacity - used (can go negative). */
  remaining: number
  /** used / capacity, clamped to [0, 1] for progress bars. */
  ratio: number
}

export interface Totals {
  /** Real loan balance: only invoiced + paid money is subtracted. */
  actualLoan: Balance
  /** Real own-contribution balance, same rule. */
  actualOwn: Balance
  /** Simulated loan balance: every active loan-funded item counts in full. */
  simulatedLoan: Balance
  /** Simulated own-contribution balance, same rule. */
  simulatedOwn: Balance
  /** Total incl. VAT of everything active, regardless of source. */
  totalActive: number
  /** Total incl. VAT of active items still awaiting payment. */
  totalOutstanding: number
  /** Outstanding money that has not been requested from the bank yet. */
  totalNotYetRequested: number
  /** Number of active rows excluded from nothing / included in the maths. */
  activeCount: number
  /** Number of disabled rows (visible but excluded). */
  disabledCount: number
}

export interface DeadlineEntry {
  key: string
  lineItemId: string
  lineItemDescription: string
  lineItemType: LineItem['type']
  supplierId: string | null
  source: FundingSource
  /** Installment label, or null when this is the line item's own due date. */
  installmentLabel: string | null
  amount: number
  dueDate: string
  daysLeft: number
  isOverdue: boolean
  requestedFromBank: boolean
}

function makeBalance(capacity: number, used: number): Balance {
  const safeCapacity = Number.isFinite(capacity) ? capacity : 0
  const remaining = roundCents(safeCapacity - used)
  const ratio =
    safeCapacity > 0 ? Math.min(Math.max(used / safeCapacity, 0), 1) : 0
  return {
    capacity: roundCents(safeCapacity),
    used: roundCents(used),
    remaining,
    ratio,
  }
}

/** Per-item derived numbers. Pure, so it is trivially testable. */
export function calcLineItem(
  item: LineItemRow,
  installments: Array<InstallmentRow> = [],
): LineItemCalc {
  const total = roundCents(Number(item.amount_incl_vat))
  const hasInstallments = installments.length > 0

  const installmentTotal = roundCents(
    installments.reduce((sum, inst) => sum + Number(inst.amount), 0),
  )
  const installmentPaidTotal = roundCents(
    installments.reduce(
      (sum, inst) => sum + (inst.paid ? Number(inst.amount) : 0),
      0,
    ),
  )

  const installmentActualLoanAmount = roundCents(
    installments.reduce(
      (sum, inst) =>
        sum + (inst.paid && inst.source === 'loan' ? Number(inst.amount) : 0),
      0,
    ),
  )
  const installmentActualOwnAmount = roundCents(
    installments.reduce(
      (sum, inst) =>
        sum + (inst.paid && inst.source === 'own' ? Number(inst.amount) : 0),
      0,
    ),
  )
  const installmentSimulatedLoanAmount = roundCents(
    installments.reduce(
      (sum, inst) => sum + (inst.source === 'loan' ? Number(inst.amount) : 0),
      0,
    ),
  )
  const installmentSimulatedOwnAmount = roundCents(
    installments.reduce(
      (sum, inst) => sum + (inst.source === 'own' ? Number(inst.amount) : 0),
      0,
    ),
  )

  // Installments override the single `paid` checkbox entirely.
  const paidAmount = hasInstallments
    ? installmentPaidTotal
    : item.invoice_received && item.paid
      ? total
      : 0

  const isPaid = hasInstallments
    ? installments.every((inst) => inst.paid)
    : item.paid

  // Same rule for the bank: each installment is requested separately, so the
  // line-item flag is only meaningful when there is no schedule.
  const isRequestedFromBank = hasInstallments
    ? installments
        .filter((inst) => inst.source === 'loan')
        .every((inst) => inst.requested_from_bank)
    : item.requested_from_bank

  // The simulation commits the full future cost. With installments configured,
  // the schedule is the source of truth for what will be invoiced.
  const simulatedAmount = hasInstallments ? installmentTotal : total
  const actualLoanAmount = hasInstallments
    ? installmentActualLoanAmount
    : item.source === 'loan'
      ? paidAmount
      : 0
  const actualOwnAmount = hasInstallments
    ? installmentActualOwnAmount
    : item.source === 'own'
      ? paidAmount
      : 0
  const simulatedLoanAmount = hasInstallments
    ? installmentSimulatedLoanAmount
    : item.source === 'loan'
      ? simulatedAmount
      : 0
  const simulatedOwnAmount = hasInstallments
    ? installmentSimulatedOwnAmount
    : item.source === 'own'
      ? simulatedAmount
      : 0
  const outstandingAmount = roundCents(Math.max(simulatedAmount - paidAmount, 0))

  const notRequestedAmount = hasInstallments
    ? roundCents(
        installments.reduce(
          (sum, inst) =>
            sum +
            (!inst.paid &&
            !inst.requested_from_bank &&
            inst.source === 'loan'
              ? Number(inst.amount)
              : 0),
          0,
        ),
      )
    : item.source === 'own' || item.requested_from_bank
      ? 0
      : outstandingAmount

  return {
    id: item.id,
    total,
    hasInstallments,
    installmentTotal,
    installmentPaidTotal,
    paidAmount,
    actualLoanAmount,
    actualOwnAmount,
    outstandingAmount,
    simulatedAmount,
    simulatedLoanAmount,
    simulatedOwnAmount,
    isPaid,
    isRequestedFromBank,
    notRequestedAmount,
    installmentMismatch:
      hasInstallments && Math.abs(installmentTotal - total) >= 0.01,
  }
}

export function calcAllLineItems(
  items: Array<LineItem>,
): Map<string, LineItemCalc> {
  const map = new Map<string, LineItemCalc>()
  for (const item of items) {
    map.set(item.id, calcLineItem(item, item.installments))
  }
  return map
}

export interface TotalsInput {
  items: Array<LineItem>
  loanAmount: number
  ownContribution: number
}

export function calcTotals({
  items,
  loanAmount,
  ownContribution,
}: TotalsInput): Totals {
  let actualLoanUsed = 0
  let actualOwnUsed = 0
  let simulatedLoanUsed = 0
  let simulatedOwnUsed = 0
  let totalActive = 0
  let totalOutstanding = 0
  let totalNotYetRequested = 0
  let activeCount = 0
  let disabledCount = 0

  for (const item of items) {
    if (item.disabled) {
      disabledCount += 1
      continue
    }
    activeCount += 1

    const calc = calcLineItem(item, item.installments)
    actualLoanUsed += calc.actualLoanAmount
    actualOwnUsed += calc.actualOwnAmount
    simulatedLoanUsed += calc.simulatedLoanAmount
    simulatedOwnUsed += calc.simulatedOwnAmount

    totalActive += calc.simulatedAmount
    totalOutstanding += calc.outstandingAmount
    totalNotYetRequested += calc.notRequestedAmount
  }

  return {
    actualLoan: makeBalance(loanAmount, actualLoanUsed),
    actualOwn: makeBalance(ownContribution, actualOwnUsed),
    simulatedLoan: makeBalance(loanAmount, simulatedLoanUsed),
    simulatedOwn: makeBalance(ownContribution, simulatedOwnUsed),
    totalActive: roundCents(totalActive),
    totalOutstanding: roundCents(totalOutstanding),
    totalNotYetRequested: roundCents(totalNotYetRequested),
    activeCount,
    disabledCount,
  }
}

/**
 * Every unpaid due date across active line items, flattened. Items with
 * installments contribute one entry per unpaid installment; items without
 * contribute their own due date.
 */
export function collectDeadlines(items: Array<LineItem>): Array<DeadlineEntry> {
  const entries: Array<DeadlineEntry> = []

  for (const item of items) {
    if (item.disabled) continue

    const base = {
      lineItemId: item.id,
      lineItemDescription: item.description,
      lineItemType: item.type,
      supplierId: item.supplier_id,
    }

    if (item.installments.length > 0) {
      for (const inst of item.installments) {
        if (inst.paid || !inst.due_date) continue
        const days = daysUntil(inst.due_date)
        if (days === null) continue
        entries.push({
          ...base,
          // Each installment is requested from the bank on its own.
          requestedFromBank: inst.requested_from_bank,
          source: inst.source,
          key: `inst-${inst.id}`,
          installmentLabel: inst.label || 'Schijf',
          amount: roundCents(Number(inst.amount)),
          dueDate: inst.due_date,
          daysLeft: days,
          isOverdue: days < 0,
        })
      }
      continue
    }

    if (item.paid || !item.due_date) continue
    const days = daysUntil(item.due_date)
    if (days === null) continue
    entries.push({
      ...base,
      requestedFromBank: item.requested_from_bank,
      source: item.source,
      key: `item-${item.id}`,
      installmentLabel: null,
      amount: roundCents(Number(item.amount_incl_vat)),
      dueDate: item.due_date,
      daysLeft: days,
      isOverdue: days < 0,
    })
  }

  return entries.sort((a, b) => a.daysLeft - b.daysLeft)
}

/** Deadlines inside the configurable warning window, overdue ones first. */
export function upcomingDeadlines(
  items: Array<LineItem>,
  warningDays: number,
): Array<DeadlineEntry> {
  return collectDeadlines(items).filter(
    (entry) => entry.daysLeft <= warningDays,
  )
}

export type PaymentStatus = 'paid' | 'partial' | 'invoiced' | 'offer' | 'open'

export function paymentStatus(
  item: LineItem,
  calc: LineItemCalc,
): PaymentStatus {
  if (calc.isPaid) return 'paid'
  if (calc.paidAmount > 0) return 'partial'
  if (item.invoice_received) return 'invoiced'
  if (item.offer_received) return 'offer'
  return 'open'
}
