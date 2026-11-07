# Redbird Grocery

Kroger + Meijer grocery delivery, shopped by Cody.

## Run it on your computer

```
npm install
npm run dev
```

Then open http://localhost:3000.

## One-time setup

1. **Database:** run every file in `supabase/migrations/` in order in the Supabase SQL Editor (each once).
2. **Settings file:** copy `.env.example` to `.env.local` and fill it in.
3. **Store locations:** `node --env-file=.env.local scripts/sync-stores.ts`
4. **Supabase sign-in settings** (Authentication → URL Configuration):
   - Site URL: `http://localhost:3000` (change to the real site address once it's live)
   - Redirect URLs: add `http://localhost:3000/auth/callback`

## Cody's screens

Make your account the admin once (SQL Editor, use your email):

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

Then open http://localhost:3000/admin

- **Upcoming**: check the orders to shop together, tap Shop
- **Shopping**: one list by aisle, color-coded by customer; Scan / Found / Swap / Out, add or remove items, set aisles
- **Calendar**: default week, block days or single 2-hour windows, tap a name to move an order
- **History**: every order, with filters and what you made; tap one for the full details
- **Customers**: everyone's contact info, addresses and order history

When you're signed in as admin, the customer side shows an **Admin** link in the menu, and the admin side has a
**Store view** link back.

**Refunding an item** (the 24-hour missing / damaged / wrong promise): open the order (History → the order, or
Details on Upcoming), tap **Refund** under the item, check the amount (it's filled in with what that item cost)
and tap Refund to card. It shows up on the customer's order page. Works once the receipt total has been saved.

The camera scanner needs https (works once the app is online); until then type the barcode number.

## Meijer aisles

Meijer only shows aisles on its own product pages, so this runs on your PC in a real Edge window.
It saves aisles into the **live** database, so it reads the live keys from `.env.live` (see Test database below;
until you've set that up, use `.env.local` in its place):

```
node --env-file=.env.live scripts/sync-meijer-aisles.ts
```

Run it the night before or morning of a shopping day. It looks up Meijer items in upcoming orders that
don't have an aisle yet (each product once per store), about one page every 4–9 seconds.
Add `--all` to fill in every Meijer item ever ordered.

**Baseline map:** `--list data/meijer-baseline.txt` searches Meijer for each line (about 170 everyday items),
takes the top 2 matches and looks them up at every Meijer. Roughly 700 pages, a bit over an hour. Ctrl+C anytime;
rerun to continue. Options: `--per 3` for more matches per line, `--store brownsburg` for one store.

## Test database (try things on your PC without touching real customers)

The live site and your PC should use **different** databases: real customers' accounts must never get test-mode
card info. The app enforces this: with test Stripe keys, checkout refuses to run against the live database.

One-time setup (about 10 minutes):

1. **Keep your live keys for scripts.** Copy `.env.local` to a new file named `.env.live` (same folder). The Meijer
   aisle script uses it, so your scraping keeps going to the live database. Both files stay off GitHub.
2. **Make the test database.** In Supabase, **New project** (free plan is fine), name it `redbird-test`.
3. **Build it.** Open `supabase/test-database-setup.sql`, copy all of it, paste into the new project's SQL Editor,
   Run. (It's every migration in one file, and it marks this database as "test". If you add a migration later,
   run `npm run db:test-setup` to rebuild the file.)
4. **Point your PC at it.** In `.env.local`, replace the three Supabase values with the new project's
   (Project Settings → API Keys / Connect). Keep the Stripe **test** keys.
5. **Store locations:** `node --env-file=.env.local scripts/sync-stores.ts`
6. **Sign-in settings** in the test project (Authentication → URL Configuration): Site URL `http://localhost:3000`,
   redirect URL `http://localhost:3000/**`. Under Authentication → Sign In / Providers → Email you can turn
   **Confirm email** off here, so test accounts work instantly.
7. `npm run dev`, create an account, then make it admin with the SQL at the top of this page (in the TEST project).

Test orders, cards and refunds now stay entirely in the test project and Stripe's test mode.

## Card payments (Stripe)

Put the test keys from Stripe → Developers → API keys in `.env.local`:
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` and `STRIPE_SECRET_KEY=sk_test_...`. Without them, checkout runs in test mode (no card).

- Checkout saves the card. If delivery is within 5 days the hold is placed right away; otherwise when you tap Shop.
- Save total on the receipt screen charges the real amount and releases the rest of the hold.
- Over the hold: a "Charge $X more" button (after the customer OKs it). Lower after charging: refunds the difference.
- Canceling an order releases its hold.
- If a hold expires before you shop (Stripe drops them after about 7 days), Save total places a fresh one automatically.

**Webhooks** keep the app in step with things that happen on Stripe's side (an expired hold, a refund or dispute
from the Stripe dashboard). Run migration `0014_stripe_webhooks.sql`, then:

- *On your PC:* install the Stripe CLI, run `stripe login`, then in a second terminal
  `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Copy the `whsec_...` it prints into
  `STRIPE_WEBHOOK_SECRET` in `.env.local`.
- *Once the site is online:* Stripe → Developers → Webhooks → Add endpoint, URL `https://your-site/api/stripe/webhook`,
  events `payment_intent.canceled`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
  Use that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.

Test cards: 4242 4242 4242 4242 (works), 4000 0000 0000 9995 (declines), any future date, any CVC, any ZIP.

## Checks

```
npm test        # pricing, schedule, stores, Kroger client
npx tsc --noEmit
npm run lint
```

## What's where

| Folder | What it is |
|---|---|
| `src/app/shop` | Search Kroger (live) and Meijer (catalog), add requests |
| `src/app/cart` | Two-store cart with fee preview |
| `src/app/checkout` | Delivery window, address, substitutions, tip; server re-prices everything |
| `src/app/orders` | Customer order history and details |
| `src/app/account` | Addresses (sets nearest stores) and contact details |
| `src/lib` | Pricing, schedule, stores, Kroger API, database loaders |
| `supabase/migrations` | Database setup, run in order |
| `supabase/test-database-setup.sql` | All migrations in one file, for a new test project (`npm run db:test-setup`) |
