import { describe, expect, it } from 'vitest'
import {
  calcLineItem,
  calcTotals,
  collectDeadlines,
  upcomingDeadlines,
} from './calculations'
import { toDateInputValue } from './format'
import type { InstallmentRow, LineItem } from './database.types'

let seq = 0

function makeItem(overrides: Partial<LineItem> = {}): LineItem {
  seq += 1
  const amountExcl = Number(overrides.amount_excl_vat ?? 1000)
  const vatRate = Number(overrides.vat_rate ?? 21)
  return {
    id: `item-${seq}`,
    user_id: 'user',
    type: 'work',
    description: `Item ${seq}`,
    supplier_id: null,
    amount_excl_vat: amountExcl,
    vat_rate: vatRate,
    // Mirrors the generated Postgres column.
    amount_incl_vat: Math.round(amountExcl * (1 + vatRate / 100) * 100) / 100,
    source: 'loan',
    offer_received: false,
    invoice_received: false,
    requested_from_bank: false,
    paid: false,
    request_submitted: false,
    due_date: null,
    attachment_url: null,
    disabled: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    installments: [],
    comments: [],
    ...overrides,
  }
}

function makeInstallment(
  lineItemId: string,
  overrides: Partial<InstallmentRow> = {},
): InstallmentRow {
  seq += 1
  return {
    id: `inst-${seq}`,
    user_id: 'user',
    line_item_id: lineItemId,
    label: 'Schijf',
    amount: 0,
    percentage: null,
    source: 'loan',
    due_date: null,
    paid: false,
    requested_from_bank: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const BUDGET = { loanAmount: 100_000, ownContribution: 20_000 }

describe('calcLineItem', () => {
  it('only counts as paid when the invoice was received AND it is paid', () => {
    expect(
      calcLineItem(makeItem({ paid: true, invoice_received: false }))
        .paidAmount,
    ).toBe(0)
    expect(
      calcLineItem(makeItem({ paid: false, invoice_received: true }))
        .paidAmount,
    ).toBe(0)
    expect(
      calcLineItem(makeItem({ paid: true, invoice_received: true })).paidAmount,
    ).toBe(1210)
  })

  it('simulates the full amount whatever the status is', () => {
    expect(calcLineItem(makeItem()).simulatedAmount).toBe(1210)
    expect(
      calcLineItem(makeItem({ offer_received: true })).simulatedAmount,
    ).toBe(1210)
  })

  it('lets installments override the top-level paid flag', () => {
    const item = makeItem({
      amount_excl_vat: 1000,
      vat_rate: 21,
      paid: true,
      invoice_received: true,
    })
    const installments = [
      makeInstallment(item.id, { amount: 363, percentage: 30, paid: true }),
      makeInstallment(item.id, { amount: 484, percentage: 40, paid: false }),
      makeInstallment(item.id, { amount: 363, percentage: 30, paid: false }),
    ]

    const calc = calcLineItem(item, installments)

    // `paid: true` on the item is ignored: only the first installment is paid.
    expect(calc.paidAmount).toBe(363)
    expect(calc.isPaid).toBe(false)
    expect(calc.simulatedAmount).toBe(1210)
    expect(calc.outstandingAmount).toBe(847)
    expect(calc.installmentMismatch).toBe(false)
  })

  it('is fully paid once every installment is paid', () => {
    const item = makeItem({ paid: false })
    const installments = [
      makeInstallment(item.id, { amount: 605, paid: true }),
      makeInstallment(item.id, { amount: 605, paid: true }),
    ]
    const calc = calcLineItem(item, installments)
    expect(calc.isPaid).toBe(true)
    expect(calc.paidAmount).toBe(1210)
    expect(calc.outstandingAmount).toBe(0)
  })

  it('lets installments override the top-level bank flag too', () => {
    const item = makeItem({ requested_from_bank: true })
    const partly = calcLineItem(item, [
      makeInstallment(item.id, { amount: 605, requested_from_bank: true }),
      makeInstallment(item.id, { amount: 605, requested_from_bank: false }),
    ])
    expect(partly.isRequestedFromBank).toBe(false)
    expect(partly.notRequestedAmount).toBe(605)

    const fully = calcLineItem(item, [
      makeInstallment(item.id, { amount: 605, requested_from_bank: true }),
      makeInstallment(item.id, { amount: 605, requested_from_bank: true }),
    ])
    expect(fully.isRequestedFromBank).toBe(true)
    expect(fully.notRequestedAmount).toBe(0)
  })

  it('ignores own-funded installments for the bank summary', () => {
    const item = makeItem({ requested_from_bank: false })
    const calc = calcLineItem(item, [
      makeInstallment(item.id, {
        amount: 605,
        source: 'loan',
        requested_from_bank: true,
      }),
      makeInstallment(item.id, {
        amount: 605,
        source: 'own',
        requested_from_bank: false,
      }),
    ])

    expect(calc.isRequestedFromBank).toBe(true)
    expect(calc.notRequestedAmount).toBe(0)
  })

  it('does not ask the bank again for installments that are already paid', () => {
    const item = makeItem()
    const calc = calcLineItem(item, [
      makeInstallment(item.id, { amount: 605, paid: true, requested_from_bank: false }),
      makeInstallment(item.id, { amount: 605, requested_from_bank: false }),
    ])
    expect(calc.notRequestedAmount).toBe(605)
  })

  it('flags a schedule that does not add up to the item total', () => {
    const item = makeItem()
    const calc = calcLineItem(item, [makeInstallment(item.id, { amount: 500 })])
    expect(calc.installmentMismatch).toBe(true)
    expect(calc.simulatedAmount).toBe(500)
  })
})

describe('calcTotals', () => {
  it('subtracts only invoiced+paid money from the actual balance', () => {
    const items = [
      makeItem({
        amount_excl_vat: 10_000,
        vat_rate: 21,
        invoice_received: true,
        paid: true,
      }),
      makeItem({ amount_excl_vat: 5_000, vat_rate: 21, offer_received: true }),
    ]
    const totals = calcTotals({ items, ...BUDGET })

    expect(totals.actualLoan.used).toBe(12_100)
    expect(totals.actualLoan.remaining).toBe(87_900)
    // Simulation includes the unpaid quote as well.
    expect(totals.simulatedLoan.used).toBe(18_150)
    expect(totals.simulatedLoan.remaining).toBe(81_850)
  })

  it('keeps loan and own contribution on separate balances', () => {
    const items = [
      makeItem({
        source: 'loan',
        amount_excl_vat: 1_000,
        vat_rate: 21,
        invoice_received: true,
        paid: true,
      }),
      makeItem({
        source: 'own',
        amount_excl_vat: 2_000,
        vat_rate: 21,
        invoice_received: true,
        paid: true,
      }),
      makeItem({ source: 'own', amount_excl_vat: 3_000, vat_rate: 21 }),
    ]
    const totals = calcTotals({ items, ...BUDGET })

    expect(totals.actualLoan.used).toBe(1_210)
    expect(totals.actualOwn.used).toBe(2_420)
    expect(totals.simulatedLoan.used).toBe(1_210)
    expect(totals.simulatedOwn.used).toBe(6_050)
    expect(totals.simulatedOwn.remaining).toBe(13_950)
  })

  it('routes installment balances by each installment source', () => {
    const item = makeItem({ source: 'loan', amount_excl_vat: 1_000 })
    item.installments = [
      makeInstallment(item.id, {
        amount: 700,
        source: 'loan',
        paid: true,
        requested_from_bank: true,
      }),
      makeInstallment(item.id, {
        amount: 510,
        source: 'own',
        paid: true,
        requested_from_bank: false,
      }),
    ]

    const totals = calcTotals({ items: [item], ...BUDGET })

    expect(totals.actualLoan.used).toBe(700)
    expect(totals.actualOwn.used).toBe(510)
    expect(totals.simulatedLoan.used).toBe(700)
    expect(totals.simulatedOwn.used).toBe(510)
    expect(totals.totalNotYetRequested).toBe(0)
  })

  it('only reports not-requested bank money for loan-funded installments', () => {
    const item = makeItem({ source: 'loan' })
    item.installments = [
      makeInstallment(item.id, { amount: 600, source: 'loan' }),
      makeInstallment(item.id, { amount: 610, source: 'own' }),
    ]

    const totals = calcTotals({ items: [item], ...BUDGET })

    expect(totals.totalNotYetRequested).toBe(600)
  })

  it('excludes disabled rows from every balance', () => {
    const items = [
      makeItem({
        amount_excl_vat: 1_000,
        invoice_received: true,
        paid: true,
        disabled: true,
      }),
      makeItem({ amount_excl_vat: 1_000 }),
    ]
    const totals = calcTotals({ items, ...BUDGET })

    expect(totals.actualLoan.used).toBe(0)
    expect(totals.simulatedLoan.used).toBe(1_210)
    expect(totals.activeCount).toBe(1)
    expect(totals.disabledCount).toBe(1)
  })

  it('reports outstanding money that is not requested from the bank yet', () => {
    const items = [
      makeItem({ amount_excl_vat: 1_000, requested_from_bank: true }),
      makeItem({ amount_excl_vat: 2_000, requested_from_bank: false }),
      makeItem({ amount_excl_vat: 3_000, source: 'own' }),
    ]
    const totals = calcTotals({ items, ...BUDGET })

    expect(totals.totalOutstanding).toBe(7_260)
    expect(totals.totalNotYetRequested).toBe(2_420)
  })

  it('counts the bank request per installment, not per line item', () => {
    const item = makeItem({ amount_excl_vat: 1_000, requested_from_bank: true })
    item.installments = [
      // Already drawn and paid - nothing left to request.
      makeInstallment(item.id, { amount: 210, requested_from_bank: true, paid: true }),
      // Requested but not paid yet.
      makeInstallment(item.id, { amount: 500, requested_from_bank: true }),
      // Not requested yet - this is the only amount still to ask the bank for.
      makeInstallment(item.id, { amount: 500, requested_from_bank: false }),
    ]
    const totals = calcTotals({ items: [item], ...BUDGET })

    expect(totals.totalNotYetRequested).toBe(500)
    expect(totals.totalOutstanding).toBe(1_000)
  })

  it('goes negative rather than clamping when overspending', () => {
    const items = [makeItem({ amount_excl_vat: 100_000, vat_rate: 21 })]
    const totals = calcTotals({ items, ...BUDGET })

    expect(totals.simulatedLoan.remaining).toBe(-21_000)
    expect(totals.simulatedLoan.ratio).toBe(1)
  })
})

describe('deadlines', () => {
  const inDays = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return toDateInputValue(date)
  }

  it('uses installment due dates instead of the item due date', () => {
    const item = makeItem({ due_date: inDays(3) })
    item.installments = [
      makeInstallment(item.id, {
        label: 'Voorschot',
        amount: 363,
        due_date: inDays(2),
        paid: true,
      }),
      makeInstallment(item.id, {
        label: 'Oplevering',
        amount: 847,
        due_date: inDays(5),
      }),
    ]

    const entries = collectDeadlines([item])
    expect(entries).toHaveLength(1)
    expect(entries[0].installmentLabel).toBe('Oplevering')
    expect(entries[0].daysLeft).toBe(5)
  })

  it('reports the bank status of the installment, not of the line item', () => {
    const item = makeItem({ requested_from_bank: true })
    item.installments = [
      makeInstallment(item.id, {
        amount: 1210,
        due_date: inDays(4),
        requested_from_bank: false,
      }),
    ]

    const entries = collectDeadlines([item])
    expect(entries[0].requestedFromBank).toBe(false)
  })

  it('sorts by urgency and respects the warning window', () => {
    const items = [
      makeItem({ due_date: inDays(20) }),
      makeItem({ due_date: inDays(-2) }),
      makeItem({ due_date: inDays(6) }),
      makeItem({ due_date: inDays(1), paid: true, invoice_received: true }),
    ]

    const entries = upcomingDeadlines(items, 14)
    expect(entries.map((entry) => entry.daysLeft)).toEqual([-2, 6])
    expect(entries[0].isOverdue).toBe(true)
  })

  it('ignores disabled rows', () => {
    const items = [makeItem({ due_date: inDays(1), disabled: true })]
    expect(upcomingDeadlines(items, 14)).toHaveLength(0)
  })
})
