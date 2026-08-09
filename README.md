# Renovatie Tracker

Financial tracker for renovating a shell home (_casco woning_): renovation loan, own
contribution, offers, invoices, payment deadlines and utility-connection requests.

React + TypeScript + Vite, shadcn/ui + Tailwind, TanStack Router, Supabase (Postgres +
Auth + RLS). Ships as a static site to GitHub Pages — free to host, reachable from any
phone or desktop browser.

---

## Features

| Page                   | What it does                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**          | Read-only overview: loan capacity, actually drawn, actually remaining, simulated remaining, plus every invoice/installment falling due inside the configurable warning window (default 14 days), sorted by urgency and flagged with whether the money was already requested from the bank.                                                                                          |
| **Werken & aanvragen** | One combined list of works and utility requests, distinguished by a leading icon. Per row: supplier, amount excl./incl. VAT, loan-vs-own funding switch, one-click status pills (offer / invoice / requested from bank / paid / submitted), attachment link, enable-disable toggle, optional installment schedule with per-installment funding source, and collapsible comments. Sticky calculation panel on the right. |
| **Instellingen**       | Loan amount, own contribution, default + available VAT rates, deadline warning window, currency/locale, and the supplier list.                                                                                                                                                                                                                                                      |
| **To-do's**            | Running renovation to-do list with due dates, priority and manual ordering.                                                                                                                                                                                                                                                                                                         |

### The two balances

This is the heart of the app, so it is implemented as pure functions in
[src/lib/calculations.ts](src/lib/calculations.ts) and covered by tests in
[src/lib/calculations.test.ts](src/lib/calculations.test.ts).

**Actual ("werkelijk") balance** — the authoritative state of the loan.
Only money that really left the account is subtracted:

- a line item counts only when **invoice received AND paid**;
- when an item has **installments**, they fully override the single funding source,
  `paid`, and `requested from bank` controls — every installment chooses **loan** or
  **own contribution** independently, only the **paid installments** count, and each
  loan-funded installment is requested from the bank on its own;
- **disabled** rows never count.

**Simulation** — two parallel forward-looking balances (loan and own contribution).
**Every active row counts in full**, regardless of offer/invoice/requested/paid status,
charged to the balance chosen by its funding source. A quote you have not paid a cent on
is already subtracted, so you can see up-front whether a work should come out of the loan
or your own savings. Items with installments contribute the sum of their schedule, split
by each installment's own funding source; if that sum differs from the item total, the
row shows a "Schijven ≠ totaal" warning.

Deadlines follow the same rule: items with installments contribute **one deadline per
unpaid installment**, everything else contributes its own due date.

---

## 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the migrations.** Either paste the two files from `supabase/migrations/` into the
   SQL editor (in filename order), or use the CLI:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. **Create your user.** Authentication → Users → _Add user_ → email + password.
   There is no sign-up screen: the app is single-user by design. Optionally turn off
   _Allow new users to sign up_ under Authentication → Sign In / Providers.
4. **Copy your credentials** from Project Settings → API:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` / publishable key → `VITE_SUPABASE_ANON_KEY`

### Notes for this project's configuration

- **"Automatically expose new tables" is disabled.** New tables therefore receive no
  privileges for the `anon` / `authenticated` roles, and PostgREST would reject every
  request even with correct RLS. The second migration grants
  `select, insert, update, delete` on each table to `authenticated` explicitly (and
  revokes everything from `anon`). **Any new table you add later needs the same grant.**
- **Automatic RLS is enabled**, so RLS is on for every new table — but RLS without
  policies means _no access at all_. The second migration writes an explicit
  `select` / `insert` / `update` / `delete` policy per table, all scoped to
  `(select auth.uid()) = user_id`.
- Every table has `user_id ... default auth.uid()`, so the client never sends a user id
  and cannot forge one.

### Security model

- The frontend only ever uses the **anon/publishable key**. It is safe to ship in a
  public bundle because it grants nothing on its own — RLS decides everything.
  **Never** put the `service_role` key in a `VITE_*` variable, a workflow, or the repo.
- Unauthenticated visitors of the GitHub Pages URL see only the login screen; the
  `anon` role has zero privileges on all six tables.

---

## 2. Run locally

```bash
pnpm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
pnpm dev                     # http://localhost:3000
```

Other scripts:

```bash
pnpm build       # generate routes, type-check, build to dist/
pnpm preview     # serve the production build
pnpm test        # run the calculation tests
pnpm lint        # eslint
```

---

## 3. Deploy to GitHub Pages

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables** → add two _repository
   variables_:

   | Name                     | Value                               |
   | ------------------------ | ----------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon / publishable key         |

   Repository _variables_ (not secrets) are used on purpose: the anon key ends up in the
   public JavaScript bundle either way, and a secret would only give a false sense of
   safety. The real protection is RLS.

4. Push to `main`. [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds
   the site and publishes it. The workflow determines the Pages sub-path itself
   (`/<repo-name>/`, or `/` for a `<user>.github.io` repo) and feeds it to Vite as
   `BASE_PATH`, and copies `index.html` to `404.html` so deep links like `/works`
   survive a hard refresh.

5. **Add the Pages URL to Supabase** → Authentication → URL Configuration → _Site URL_ /
   _Redirect URLs_: `https://<user>.github.io/<repo>/`.

---

## Data model

```
settings      one row per user: loan_amount, own_contribution, default_vat_rate,
              vat_rates[], deadline_warning_days, currency, locale
suppliers     name, contact, email, phone, website, notes
line_items    type (work|request), description, supplier_id, amount_excl_vat, vat_rate,
              amount_incl_vat (generated), source (loan|own), offer_received,
              invoice_received, requested_from_bank, paid, request_submitted,
              due_date, attachment_url, disabled, sort_order
installments  line_item_id, label, amount, percentage, source (loan|own), due_date, paid,
              requested_from_bank, sort_order
comments      line_item_id, body, created_at
todos         title, notes, done, due_date, priority, sort_order, completed_at
```

## Assumptions made

- The loan is one fixed amount available up front; requesting money from the bank and
  paying the contractor happen together, so there are no separate draw records — just the
  `requested_from_bank` and `paid` flags per line (or per installment, when a payment
  schedule is configured).
- Actual and simulated balances are tracked for **both** the loan and the own
  contribution, so an item paid from savings never reduces the loan.
- All balance maths uses amounts **incl. VAT**, because that is what is actually
  transferred. Excl. VAT and the rate stay visible on every row.
- `amount_incl_vat` is a generated Postgres column, so it can never drift from
  `amount_excl_vat × (1 + vat_rate / 100)`.
- Installment amounts are stored in euros; when you enter a percentage the client keeps
  the amount in sync (also when the parent total later changes).
- The UI language is Dutch, matching the domain (offerte, factuur, aanvraag, schijf).
