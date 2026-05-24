# PatchPal

A hardware session companion for music producers. Log BPM, patch settings, sync chains, mood, and gear for every jam — then recall or fork sessions later.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS v3
- Supabase (auth + Postgres + RLS)
- React Router v6 · React Hook Form · Zustand

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/bprzybytkowski/patch-pal.git
cd patch-pal
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, then run the SQL from [`docs/prd/initial.md`](docs/prd/initial.md) (the SUPABASE SCHEMA section) in the SQL editor — in order.

### 3. Configure env vars

```bash
cp .env.local.example .env.local
```

Fill in the two values from your Supabase project → **Settings → API**:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` / `public` key |

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign up, add gear at `/devices`, then log a session at `/sessions/new`.

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Deploy

Hosted on Vercel. Push to `main` → auto-deploys. Set the same two env vars in the Vercel project dashboard.
