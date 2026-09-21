# Hillpath

Offline-first memory activities, reminders and screening support for people living with dementia, for Smart India Hackathon 2026, problem statement 26003. A prototype. Not a medical device. It does not diagnose.

The full plan is in `implementation_plan.md`. What is built, what is simulated and what is planned is in `docs/status.md`.

## What is here

| Path | What it is |
|---|---|
| `apps/app` | The app for the person, the family and the health worker. Vite, React, Tailwind, Dexie. Android through Capacitor. |
| `apps/landing` | The public landing page with the scroll-driven film. Six routes, all static. |
| `apps/relay` | A ciphertext relay (Hono, Cloudflare Workers, D1). Built and tested, not deployed. |
| `packages/core` | Op-log with hybrid logical clocks, encryption, pairing, QR paging, reminders, alerts, consent, audit log. |
| `packages/ml` | M1 ability model and level choice, M2 staging evaluator, M3 trend and change, M4 explanations. |
| `packages/sim` | The simulator and the evaluation harness. Everything it makes is synthetic. |
| `ml` | Python pipeline that trains M2 on simulator output. |
| `tools` | Avoid-list checker, hero media build. |

## Run it

Needs Node 22, pnpm 12.5.1, Python 3.12 or newer with uv, ffmpeg. PowerShell:

```powershell
pnpm install
pnpm test                 # unit tests in every package
pnpm typecheck
pnpm check:avoid          # design avoid-list, secrets, dashes
uv sync --project ml
uv run --project ml python -m pytest -q ml

pnpm --filter app build
pnpm --filter app preview            # http://localhost:4173
$env:SITE_ORIGIN = 'http://localhost:4174'; $env:APP_URL = 'http://localhost:4173/'
pnpm --filter landing build
pnpm --filter landing preview        # http://localhost:4174

pnpm --filter app e2e                # two offline devices, five games, monthly check, time machine
pnpm --filter landing e2e            # meta, widths, film states, accessibility, links
```

Retrain the staging model from simulated data:

```powershell
pnpm --filter "@hillpath/sim" exec tsx src/cli.ts m2-data --n 8000 --out ../../ml/data/sim/m2.jsonl
uv run --project ml python ml/m2_train.py
pnpm --filter "@hillpath/sim" exec tsx src/cli.ts m1-eval --n 60 --days 90 --out ../../ml/reports/m1.md
```

## Secrets

`OPENROUTER_API_KEY` is never stored in this repository and is not used by any build step yet. `.env.example` lists variable names only. `pnpm check:avoid` fails on anything that looks like a key.

## Android

See `docs/android.md`. The Capacitor project is created; building the APK needs Android Studio and JDK 21, which are not installed on this machine.
