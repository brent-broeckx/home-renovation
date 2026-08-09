import {
  useMutation,
  useQuery,
  useQueryClient
  
} from '@tanstack/react-query'
import type {QueryClient} from '@tanstack/react-query';
import { toast } from 'sonner'
import { supabase } from './supabase'
import type {
  CommentRow,
  InstallmentRow,
  LineItem,
  LineItemRow,
  SettingsRow,
  SupplierRow,
  TodoRow,
} from './database.types'

export const queryKeys = {
  settings: ['settings'] as const,
  suppliers: ['suppliers'] as const,
  lineItems: ['line-items'] as const,
  todos: ['todos'] as const,
}

export const DEFAULT_SETTINGS: Omit<
  SettingsRow,
  'user_id' | 'created_at' | 'updated_at'
> = {
  loan_amount: 0,
  own_contribution: 0,
  default_vat_rate: 21,
  vat_rates: [6, 21],
  deadline_warning_days: 14,
  currency: 'EUR',
  locale: 'nl-BE',
}

function fail(context: string, error: { message: string } | null): void {
  if (!error) return
  toast.error(`${context}: ${error.message}`)
  throw new Error(error.message)
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async (): Promise<SettingsRow> => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle()
      fail('Instellingen laden mislukt', error)

      if (data) return data as SettingsRow

      // First run for this user: create the singleton settings row.
      const { data: created, error: insertError } = await supabase
        .from('settings')
        .insert(DEFAULT_SETTINGS)
        .select('*')
        .single()
      fail('Instellingen aanmaken mislukt', insertError)
      return created as SettingsRow
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<SettingsRow>) => {
      const { data, error } = await supabase
        .from('settings')
        .update(patch)
        .not('user_id', 'is', null)
        .select('*')
        .single()
      fail('Instellingen opslaan mislukt', error)
      return data as SettingsRow
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings })
      const previous = queryClient.getQueryData<SettingsRow>(queryKeys.settings)
      if (previous) {
        queryClient.setQueryData<SettingsRow>(queryKeys.settings, {
          ...previous,
          ...patch,
        })
      }
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
  })
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: async (): Promise<Array<SupplierRow>> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })
      fail('Leveranciers laden mislukt', error)
      return (data ?? []) as Array<SupplierRow>
    },
  })
}

export function useSaveSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (supplier: Partial<SupplierRow> & { name: string }) => {
      if (supplier.id) {
        const { id, ...patch } = supplier
        const { data, error } = await supabase
          .from('suppliers')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single()
        fail('Leverancier opslaan mislukt', error)
        return data as SupplierRow
      }
      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplier)
        .select('*')
        .single()
      fail('Leverancier toevoegen mislukt', error)
      return data as SupplierRow
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lineItems })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      fail('Leverancier verwijderen mislukt', error)
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lineItems })
    },
  })
}

/* ------------------------------------------------------------------ */
/* Line items (works + requests)                                       */
/* ------------------------------------------------------------------ */

const LINE_ITEM_SELECT = '*, installments(*), comments(*)'

function sortLineItem(item: LineItem): LineItem {
  return {
    ...item,
    installments: [...item.installments].sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    ),
    comments: [...item.comments].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  }
}

export function useLineItems() {
  return useQuery({
    queryKey: queryKeys.lineItems,
    queryFn: async (): Promise<Array<LineItem>> => {
      const { data, error } = await supabase
        .from('line_items')
        .select(LINE_ITEM_SELECT)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      fail('Werken laden mislukt', error)
      return ((data ?? []) as unknown as Array<LineItem>).map(sortLineItem)
    },
  })
}

type LineItemInsert = Partial<LineItemRow> & { description: string }

export function useCreateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: LineItemInsert) => {
      const { data, error } = await supabase
        .from('line_items')
        .insert(values)
        .select(LINE_ITEM_SELECT)
        .single()
      fail('Toevoegen mislukt', error)
      return sortLineItem(data)
    },
    onSuccess: () => invalidateLineItems(queryClient),
  })
}

export function useUpdateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<LineItemRow>
    }) => {
      const { data, error } = await supabase
        .from('line_items')
        .update(patch)
        .eq('id', id)
        .select(LINE_ITEM_SELECT)
        .single()
      fail('Opslaan mislukt', error)
      return sortLineItem(data)
    },
    // Optimistic: checkbox toggles must feel instant, especially on mobile.
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.lineItems })
      const previous = queryClient.getQueryData<Array<LineItem>>(
        queryKeys.lineItems,
      )
      queryClient.setQueryData<Array<LineItem>>(queryKeys.lineItems, (old) =>
        (old ?? []).map((item) =>
          item.id === id ? applyLineItemPatch(item, patch) : item,
        ),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.lineItems, context.previous)
      }
    },
    onSettled: () => invalidateLineItems(queryClient),
  })
}

/** Keeps the generated `amount_incl_vat` column in sync while optimistic. */
function applyLineItemPatch(
  item: LineItem,
  patch: Partial<LineItemRow>,
): LineItem {
  const next = { ...item, ...patch }
  const excl = Number(next.amount_excl_vat)
  const rate = Number(next.vat_rate)
  next.amount_incl_vat = Math.round(excl * (1 + rate / 100) * 100) / 100
  return next
}

export function useDeleteLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('line_items').delete().eq('id', id)
      fail('Verwijderen mislukt', error)
      return id
    },
    onSuccess: () => invalidateLineItems(queryClient),
  })
}

/* ------------------------------------------------------------------ */
/* Installments                                                        */
/* ------------------------------------------------------------------ */

export function useSaveInstallment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      installment: Partial<InstallmentRow> & { line_item_id: string },
    ) => {
      if (installment.id) {
        const { id, ...patch } = installment
        const { data, error } = await supabase
          .from('installments')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single()
        fail('Schijf opslaan mislukt', error)
        return data as InstallmentRow
      }
      const { data, error } = await supabase
        .from('installments')
        .insert(installment)
        .select('*')
        .single()
      fail('Schijf toevoegen mislukt', error)
      return data as InstallmentRow
    },
    onMutate: async (installment) => {
      if (!installment.id) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey: queryKeys.lineItems })
      const previous = queryClient.getQueryData<Array<LineItem>>(
        queryKeys.lineItems,
      )
      queryClient.setQueryData<Array<LineItem>>(queryKeys.lineItems, (old) =>
        (old ?? []).map((item) =>
          item.id === installment.line_item_id
            ? {
                ...item,
                installments: item.installments.map((inst) =>
                  inst.id === installment.id
                    ? { ...inst, ...installment }
                    : inst,
                ),
              }
            : item,
        ),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.lineItems, context.previous)
      }
    },
    onSettled: () => invalidateLineItems(queryClient),
  })
}

export function useDeleteInstallment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('installments')
        .delete()
        .eq('id', id)
      fail('Schijf verwijderen mislukt', error)
      return id
    },
    onSuccess: () => invalidateLineItems(queryClient),
  })
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export function useAddComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      lineItemId,
      body,
    }: {
      lineItemId: string
      body: string
    }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({ line_item_id: lineItemId, body })
        .select('*')
        .single()
      fail('Opmerking toevoegen mislukt', error)
      return data as CommentRow
    },
    onSuccess: () => invalidateLineItems(queryClient),
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', id)
      fail('Opmerking verwijderen mislukt', error)
      return id
    },
    onSuccess: () => invalidateLineItems(queryClient),
  })
}

/* ------------------------------------------------------------------ */
/* To-dos                                                              */
/* ------------------------------------------------------------------ */

export function useTodos() {
  return useQuery({
    queryKey: queryKeys.todos,
    queryFn: async (): Promise<Array<TodoRow>> => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('done', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      fail('To-dos laden mislukt', error)
      return (data ?? []) as Array<TodoRow>
    },
  })
}

export function useSaveTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (todo: Partial<TodoRow> & { title: string }) => {
      if (todo.id) {
        const { id, ...patch } = todo
        const { data, error } = await supabase
          .from('todos')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single()
        fail('To-do opslaan mislukt', error)
        return data as TodoRow
      }
      const { data, error } = await supabase
        .from('todos')
        .insert(todo)
        .select('*')
        .single()
      fail('To-do toevoegen mislukt', error)
      return data as TodoRow
    },
    onMutate: async (todo) => {
      if (!todo.id) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey: queryKeys.todos })
      const previous = queryClient.getQueryData<Array<TodoRow>>(queryKeys.todos)
      queryClient.setQueryData<Array<TodoRow>>(queryKeys.todos, (old) =>
        (old ?? []).map((row) =>
          row.id === todo.id ? { ...row, ...todo } : row,
        ),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.todos, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('todos').delete().eq('id', id)
      fail('To-do verwijderen mislukt', error)
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })
}

function invalidateLineItems(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.lineItems })
}
