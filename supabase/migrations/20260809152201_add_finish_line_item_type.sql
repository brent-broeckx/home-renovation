-- Afwerkingen use the same financial model as works, but are shown on their
-- own page. They stay in line_items so calculations, suppliers, installments,
-- comments and RLS policies remain shared and consistent.
alter type public.line_item_type add value if not exists 'finish';
