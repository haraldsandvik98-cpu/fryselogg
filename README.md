# Fryselogg

Fangstlogg for norske fisketrålere. Turer og fangster lagres i Supabase, med innlogging via e-post og passord. Hver bruker ser bare egne data (Row Level Security).

Catch log for Norwegian fishing trawlers. Trips and catches are stored in Supabase, with email/password login. Each user only sees their own data (Row Level Security).

## Features

- Log in or create an account (Supabase Auth)
- Start a trip, log catches (species, quantity, unit, optional location, time, temperature, notes)
- Running onboard totals by species
- End a trip and review past trips
- Norwegian / English language toggle (remembered in the browser)

## Local development

1. Copy `.env.example` to `.env` and fill in your Supabase URL and anon/publishable key.
2. Install and start:

```bash
npm install
npm run dev
```

3. Apply `supabase/migrations/001_init.sql` in the Supabase SQL editor if the tables are not created yet.

## Deploy

GitHub Pages is set up via `.github/workflows/deploy.yml`. The workflow needs these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Schema

- `trips`: `id`, `user_id`, `boat`, `started_at`, `ended_at`, `notes`, `created_at`
- `catches`: `id`, `trip_id` (FK to `trips`), `species`, `quantity`, `unit`, `location`, `caught_at`, `temperature`, `notes`, `created_at`
