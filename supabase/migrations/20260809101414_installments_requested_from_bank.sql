-- Each installment can be requested from the bank separately, so the flag
-- belongs on the installment as well. When a line item has installments they
-- take over from the line-item level flag entirely, exactly like `paid`.
alter table public.installments
  add column if not exists requested_from_bank boolean not null default false;

-- Backfill: schedules created before this column existed inherit the state of
-- their parent line item so nothing silently flips to "not requested".
update public.installments i
set requested_from_bank = li.requested_from_bank
from public.line_items li
where li.id = i.line_item_id
  and li.requested_from_bank
  and not i.requested_from_bank;

create index if not exists installments_requested_from_bank_idx
  on public.installments (line_item_id)
  where not requested_from_bank;
