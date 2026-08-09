-- ============================================================
-- RLS policies: every row is scoped to the owning auth.uid().
-- Only the `authenticated` role gets access; `anon` gets nothing.
-- ============================================================

-- ---------- settings ----------
drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "settings_insert_own" on public.settings;
create policy "settings_insert_own" on public.settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "settings_update_own" on public.settings;
create policy "settings_update_own" on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "settings_delete_own" on public.settings;
create policy "settings_delete_own" on public.settings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- suppliers ----------
drop policy if exists "suppliers_select_own" on public.suppliers;
create policy "suppliers_select_own" on public.suppliers
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "suppliers_insert_own" on public.suppliers;
create policy "suppliers_insert_own" on public.suppliers
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "suppliers_update_own" on public.suppliers;
create policy "suppliers_update_own" on public.suppliers
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "suppliers_delete_own" on public.suppliers;
create policy "suppliers_delete_own" on public.suppliers
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- line_items ----------
drop policy if exists "line_items_select_own" on public.line_items;
create policy "line_items_select_own" on public.line_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "line_items_insert_own" on public.line_items;
create policy "line_items_insert_own" on public.line_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "line_items_update_own" on public.line_items;
create policy "line_items_update_own" on public.line_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "line_items_delete_own" on public.line_items;
create policy "line_items_delete_own" on public.line_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- installments ----------
-- The nested EXISTS is itself filtered by line_items RLS, so it also
-- guarantees the parent line item belongs to the same user.
drop policy if exists "installments_select_own" on public.installments;
create policy "installments_select_own" on public.installments
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "installments_insert_own" on public.installments;
create policy "installments_insert_own" on public.installments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.line_items li where li.id = line_item_id)
  );

drop policy if exists "installments_update_own" on public.installments;
create policy "installments_update_own" on public.installments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.line_items li where li.id = line_item_id)
  );

drop policy if exists "installments_delete_own" on public.installments;
create policy "installments_delete_own" on public.installments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- comments ----------
drop policy if exists "comments_select_own" on public.comments;
create policy "comments_select_own" on public.comments
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.line_items li where li.id = line_item_id)
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- todos ----------
drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- Data API exposure.
-- "Automatically expose new tables" is OFF for this project, which means
-- the default privileges in the public schema do NOT grant anon /
-- authenticated any DML on newly created tables. PostgREST would answer
-- 401/permission denied even with correct RLS policies, so we grant
-- explicitly here. `anon` is deliberately left with no access at all.
-- ============================================================
grant select, insert, update, delete on table public.settings     to authenticated;
grant select, insert, update, delete on table public.suppliers    to authenticated;
grant select, insert, update, delete on table public.line_items   to authenticated;
grant select, insert, update, delete on table public.installments to authenticated;
grant select, insert, update, delete on table public.comments     to authenticated;
grant select, insert, update, delete on table public.todos        to authenticated;

revoke all on table public.settings     from anon;
revoke all on table public.suppliers    from anon;
revoke all on table public.line_items   from anon;
revoke all on table public.installments from anon;
revoke all on table public.comments     from anon;
revoke all on table public.todos        from anon;

-- amount_incl_vat is a generated column: PostgREST must not try to write it.
revoke update (amount_incl_vat) on table public.line_items from authenticated;
revoke insert (amount_incl_vat) on table public.line_items from authenticated;
