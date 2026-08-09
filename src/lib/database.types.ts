/**
 * Database types for the renovation finance tracker.
 * Mirrors the SQL in `supabase/migrations`.
 */

export type LineItemType = 'work' | 'request'
export type FundingSource = 'loan' | 'own'

export interface SettingsRow {
  user_id: string
  loan_amount: number
  own_contribution: number
  default_vat_rate: number
  vat_rates: Array<number>
  deadline_warning_days: number
  currency: string
  locale: string
  created_at: string
  updated_at: string
}

export interface SupplierRow {
  id: string
  user_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LineItemRow {
  id: string
  user_id: string
  type: LineItemType
  description: string
  supplier_id: string | null
  amount_excl_vat: number
  vat_rate: number
  /** Generated column: round(amount_excl_vat * (1 + vat_rate / 100), 2) */
  amount_incl_vat: number
  source: FundingSource
  offer_received: boolean
  invoice_received: boolean
  requested_from_bank: boolean
  paid: boolean
  request_submitted: boolean
  due_date: string | null
  attachment_url: string | null
  disabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface InstallmentRow {
  id: string
  user_id: string
  line_item_id: string
  label: string
  /** Amount incl. VAT for this installment. */
  amount: number
  /** Optional % of the parent total; when set, `amount` is derived from it. */
  percentage: number | null
  /** Funding source for this specific installment. */
  source: FundingSource
  due_date: string | null
  paid: boolean
  /** Requested from the bank for this specific installment. */
  requested_from_bank: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CommentRow {
  id: string
  user_id: string
  line_item_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface TodoRow {
  id: string
  user_id: string
  title: string
  notes: string | null
  done: boolean
  due_date: string | null
  /** 0 = low, 1 = normal, 2 = high */
  priority: number
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** A line item joined with its installments and comment count. */
export interface LineItem extends LineItemRow {
  installments: Array<InstallmentRow>
  comments: Array<CommentRow>
}
