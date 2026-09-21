# Build status

Written 2026-09-22 from what was run on this machine. Tags: Implemented (runs on real input), Simulated (runs on synthetic data only), Roadmap (not built).

## Requirements

| ID | Requirement | State | Evidence |
|---|---|---|---|
| R1 | Cognitive activities | Implemented: 5 of the 10 planned games (Pairs at Home, Faces and Names, Story Time, Routine Steps, Find It) | `apps/app/e2e/games.spec.ts`, `offline-sync.spec.ts` play each to the end |
| R2 | ML adapts difficulty | Implemented; evaluated on Simulated people | `packages/ml/src/m1.ts`, `ml/reports/m1.md`, `packages/sim/src/sim.test.ts` |
| R3 | Multilingual, voice-assisted | Partly: voice prompts on every patient screen, family recordings override the device voice, English only | See `docs/known-gaps.md` items 1 and 2 |
| R4 | Culturally familiar themes | Not met in practice. Neutral household icons only; no rights-cleared cultural assets | `content/cultural-register.json` |
| R5 | Reminders | Implemented in the app and core (windows, missed-dose rule, hydration limit). Native alarms are written but not tested on a device | `packages/core/src/care.test.ts`, `apps/app/src/lib/notify.ts` |
| R6 | Caregiver and health-worker monitoring | Implemented for the family view. Health-worker visit mode not built | `apps/app/src/caregiver/Dashboard.tsx` |
| R7 | Offline | Implemented in browser tests with both devices offline. Not yet tested on Android devices | `apps/app/e2e/offline-sync.spec.ts` |
| R8 | Mobile and tablet, elderly-friendly | Implemented: 22 px text, 64 px buttons, one primary action, no timers, errorless feedback. axe clean on the family screens | `apps/app/e2e/shell.spec.ts` |
| R9 | Long-term engagement, social | Not built (postcards, life story, music) | none |
| R10 | Stage and severity prediction | Simulated. Ordinal model with education norms and conformal sets, trained on synthetic data only | `ml/reports/m2.md`, `packages/ml/src/m2.test.ts` (parity with Python) |
| R11 | Landing page | Implemented: film scrubbed by scroll, six routes, SEO set, fallbacks | `apps/landing/e2e/landing.spec.ts` (23 tests), Lighthouse below |
| R12 | Quality asks | Implemented: meta on every route, favicon set, 404 and offline pages, links checked, avoid-list checker | `tools/checks`, landing e2e |
| ES4 | Alerts | Implemented: three tiers, batching, escalation, urgent never snoozed | `packages/core/src/care.test.ts` |
| ES5 | Offline synchronisation | Implemented: encrypted ops, QR paging with gzip, pairing without network. Relay server built, client not wired | `packages/core`, `apps/relay` |
| ES6 | Secure data | Partly: ops, secrets and blobs sealed at rest with a non-extractable browser key; shares encrypted and signed; consent ledger and hash-chained audit log. No legal review | `docs/known-gaps.md` |
| M3 | Forecast and change | Simulated. Sudden-change path catches 22 of 30 simulated episodes with 0.30 false alarms per person-year; the checklist path covers the rest | `packages/sim/src/abrupt.test.ts` |

## Numbers (all Simulated unless stated)

| Item | Result | Target in the plan | Met |
|---|---|---|---|
| M1 rounds in the 0.75 to 0.85 success band, logistic response, 60 personas x 90 days | 0.399 for M1, 0.152 for the old rule, difference +0.247 (95% interval 0.213 to 0.281) | M1 above the old rule with the interval excluding zero | Yes |
| Same with a different response form (probit) | 0.297 against 0.132, difference +0.164 (0.135 to 0.194) | same | Yes |
| Frustration events (3 misses in a row) per session | 0.03 for M1, 0.13 for the old rule | lower | Yes |
| M2 quadratic weighted kappa on 1,600 held-out synthetic people | 0.824 | no fixed target | n/a |
| M2 expected calibration error | 0.024 | 0.05 or less | Yes |
| M2 90% conformal coverage overall | 0.929 | within 2 points of 0.90 | Yes |
| M2 coverage in each schooling band | 0.946, 0.882, 0.927, 0.936 | within 2 points of 0.90 | No, the 1 to 4 years band is 0.882 |
| Sudden-change data rule, sensitivity on simulated episodes | 22 of 30 (0.73) | 0.90 | No |
| Sudden-change data rule, false alarms per stable person-year | 0.30 | 0.5 or less | Yes |
| Landing page on Lighthouse mobile with simulated 4G | performance 99, accessibility 100, best practices 100, SEO 100 | LCP 2.5 s or less | Yes: LCP 1.8 s, CLS 0, TBT 0 ms |
| Landing JavaScript | 241 KB main (75 KB gzip) plus 37 KB film chunk | 120 KB gzip or less | Yes |
| Mobile critical path | 360,811 bytes | 5 MB or less | Yes |

These numbers describe the simulator, not people. The simulator draws instruments from the same stage variable the model predicts, and the M1 logistic case uses the model's own response form. See `docs/model-card.md`.

## Tests run on 2026-09-22

| Suite | Count | Result |
|---|---|---|
| Unit: contracts 3, core 23, ml 25, sim 7, landing 7, relay 6, tools 15 | 86 | pass |
| Python (leakage guard, conformal, parity, split by person) | 5 | pass |
| Browser: app 10, landing 23 | 33 | pass |
| Typecheck, all packages | | clean |
| Avoid-list checker, 14 rules | | no findings |

Not run: any test on an Android device, Lighthouse desktop, TalkBack, iPhone Safari, the GitHub Actions workflow.
