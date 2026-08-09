-- Each installment can be paid from either the renovation loan or own funds.
-- When a line item has installments, this installment-level source takes over
-- from line_items.source for actual and simulated balances.
alter table public.installments
  add column if not exists source public.funding_source not null default 'loan';

-- Existing schedules inherit the parent line-item source so current balances do
-- not change when this feature is deployed.
update public.installments i
set source = li.source
from public.line_items li
where li.id = i.line_item_id
  and i.source is distinct from li.source;

comment on column public.installments.source is 'Funding source for this installment. Overrides the parent line_items.source when a schedule exists.';

create index if not exists installments_line_item_source_idx
  on public.installments (line_item_id, source);
