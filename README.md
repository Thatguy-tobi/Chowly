# Chowly

A restaurant ordering application built for the TeSA Africa build assignment. A
customer sits down, browses the menu, sends an order to the kitchen and watches
it being prepared; a waiter picks the order up, records who cooked it and marks
it served; the customer rates it, complains if it ran late, and settles the bill
before leaving.

There is no login. A switch at the top of every screen moves between acting as
the customer and acting as the waiter.

**Live application:** _added once deployed_

## What it does

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Menu with name, price and preparation time, loaded from a database | `/menu` |
| 2 | Place an order and see the estimated wait | `/cart` → `/orders/[reference]` |
| 3 | Waiter records the chef and bartender, then marks the order served | `/waiter/orders/[reference]` |
| 4 | Complaint and rating stored against the order | `/orders/[reference]` |
| 5 | Payment recorded and clearly labelled as pretend | `/orders/[reference]` |
| 6 | Switch between customer and waiter, no login | the header, every page |
| 7 | Everything stored in Postgres and survives a refresh | `prisma/schema.prisma` |
| 8 | Deployed and openable by anyone | Vercel + Neon |

No money moves anywhere in this application. Payments are simulated, recorded
with an `isPretend` flag on the row itself, and labelled as such on screen.

## How the waiting time is worked out

A kitchen does not cook two fish one after the other, and the bar works at the
same time as the kitchen. So the estimate is:

```
food  = slowest food item  + 3 minutes per extra food portion
drink = slowest drink item + 2 minutes per extra drink portion
wait  = max(food, drink)
```

This lives in `src/lib/wait-time.ts` and is deliberately identical to the copy
in `docs/generate-seed-data.py`, so seeded orders and live orders are quoted on
the same rules.

## Built with

- **Next.js 16** (App Router) and **React 19** — one codebase for the interface
  and the API, so there is a single thing to deploy
- **Prisma 7** against **PostgreSQL**, hosted on **Neon**
- **Tailwind CSS 4**
- **Zod** on every request body
- Deployed on **Vercel**

## Running it locally

```bash
npm install
cp .env.example .env      # then fill in your own Neon connection strings
npx prisma migrate dev    # create the tables
npm run db:seed           # load the sample data
npm run dev               # http://localhost:3000
```

`.env` needs two URLs from the same Neon database: `DATABASE_URL` (the pooled
endpoint, used by the running application) and `DIRECT_URL` (the direct
endpoint, used by migrations, which cannot run through the pooler).

### Other commands

| Command | What it does |
|---|---|
| `npm run db:seed` | Load the sample dataset |
| `npx tsx prisma/verify.ts` | Re-read the database and check every invariant independently |
| `python docs/generate-seed-data.py` | Regenerate the spreadsheet **and** `prisma/seed-data.ts` together |
| `npm run build` | Production build |

## The data

`docs/generate-seed-data.py` is the single source of the sample data. It writes
both `Chowly - Seed Data.xlsx` (for reading) and `prisma/seed-data.ts` (for
seeding) in one run, so the two cannot drift apart. It refuses to write
anything if a check fails — the arithmetic must be exact, foreign keys must
resolve, staff must be employed before the orders they handled, nothing may be
dated in the future, and a meal cannot be rated before it has been served.

`prisma/verify.ts` then reads the database back and checks the same rules
independently, so a bug in the seeding cannot pass unnoticed.

Twelve entities, taken from the Assignment 1 data model. Every deviation from
that model is marked `CHANGE nnn` in `prisma/schema.prisma` and written up with
its reason in `Chowly - Project Log.docx`.

## Repository layout

```
prisma/          schema, migrations, seed data, verification script
src/app/         pages and API routes
src/components/  shared interface pieces
src/lib/         database client, session, cart, wait time, validation
docs/            the seed data generator and the project log source
```
