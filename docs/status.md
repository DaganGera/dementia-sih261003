# Build status

Written 2026-09-22 from what was run on this machine. Tags: Implemented (runs on real input), Simulated (runs on synthetic data only), Roadmap (not built).

## Requirements

| ID | Requirement | State | Evidence |
|---|---|---|---|
| R1 | Cognitive activities | Implemented: all 10 planned activities (Pairs at Home, Faces and Names, Story Time, Routine Steps, Find It, Sound Match, Pattern Weave, Places I Know, and the two unscored activities Memories and Music) | `apps/app/e2e/games.spec.ts`, `more-games.spec.ts`, `offline-sync.spec.ts` play each to the end |
| R2 | ML adapts difficulty | Implemented; evaluated on Simulated people | `packages/ml/src/m1.ts`, `ml/reports/m1.md`, `packages/sim/src/sim.test.ts` |
| R3 | Multilingual, voice-assisted | Partly: voice prompts on every patient screen, personal voice answers by keyword spotting, family recordings override the device voice, a signed language-pack manager exists in code (tiers, verify, rollback), but English is the only language actually shipped | `packages/core/src/langpack.ts`, `apps/app/src/lib/i18n.ts`; see `docs/known-gaps.md` items 1 and 2 |
| R4 | Culturally familiar themes | Not met in practice. Neutral household icons only; no rights-cleared cultural assets | `content/cultural-register.json` |
| R5 | Reminders | Implemented in the app and core (windows, missed-dose rule, hydration limit). Native alarms are written but not tested on a device | `packages/core/src/care.test.ts`, `apps/app/src/lib/notify.ts` |
| R6 | Caregiver and health-worker monitoring | Implemented: the family dashboard, a health-worker visit mode with a spoken and pictured monthly check, and a signed one-page doctor report a clinician can verify | `apps/app/src/caregiver/{Dashboard,Visit}.tsx`, `apps/app/e2e/visit-report.spec.ts` |
| R7 | Offline | Implemented in browser tests with both devices offline. Not yet tested on Android devices | `apps/app/e2e/offline-sync.spec.ts` |
| R8 | Mobile and tablet, elderly-friendly | Implemented: 22 px text, 64 px buttons, one primary action, no timers, errorless feedback. axe clean on the family screens | `apps/app/e2e/shell.spec.ts` |
| R9 | Long-term engagement, social | Implemented: Memories and Music (unscored), voice postcards from family with an optional photo, and a shared round of Find It both a family member and the person can play from their own devices | `apps/app/e2e/social.spec.ts` |
| R10 | Stage and severity prediction | Simulated. Ordinal model with education norms and conformal sets, trained on synthetic data only; a monotone LightGBM and an Explainable Boosting Classifier were compared against it under a selection rule fixed before training, and the shipped model kept its place | `ml/reports/m2.md`, `ml/reports/m2-candidates.md`, `packages/ml/src/m2.test.ts` (parity with Python) |
| R11 | Landing page | Implemented: film scrubbed by scroll, six routes, all 10 activities shown, SEO set, fallbacks | `apps/landing/e2e/landing.spec.ts` (23 tests), Lighthouse below |
| R12 | Quality asks | Implemented: meta on every route, favicon set, 404 and offline pages, links checked, avoid-list checker | `tools/checks`, landing e2e |
| ES4 | Alerts | Implemented: three tiers, batching, escalation, urgent never snoozed, and the push budget for non-urgent alerts tightens on its own when a private, device-only caregiver check-in says the carer is stretched | `packages/core/src/{alerts,burden}.test.ts` |
| ES5 | Offline synchronisation | Implemented: encrypted ops, fountain and paged QR codes, pairing without network, a relay client wired to the app, courier mode with a write-only drop token, and LAN WebRTC by QR-exchanged SDP | `packages/core`, `apps/relay`, `apps/app/e2e/sync-ladder.spec.ts` |
| ES6 | Secure data | Partly: ops, secrets and blobs sealed at rest with a non-extractable browser key; shares encrypted and signed; consent ledger and hash-chained audit log; an optional PIN (PBKDF2, slower retries) or platform passkey on the person's tablet's family area. No legal review, and the PIN is not a strong protection against a device held for a long time | `docs/known-gaps.md` |
| M3 | Forecast and change | Simulated. Sudden-change path catches about half of simulated episodes with 0.30 false alarms per person-year under the current ten-activity roster; the family checklist path covers the rest. A time-of-day pattern view (sundowning) is also Simulated | `packages/sim/src/{abrupt,timeofday}.test.ts` |

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
| M2 candidates (Simulated): monotone LightGBM and an Explainable Boosting Classifier, same split and norms | LightGBM QWK 0.808, MAE 0.431, ECE 0.031; EBM QWK 0.817, MAE 0.424, ECE 0.024; both clear the 0.05 ECE target but neither beats the shipped model's MAE of 0.409 | Fixed selection rule (lowest MAE at or under an ECE of 0.05) | Shipped model kept its place |
| LightGBM to ONNX, max probability difference from native | about 2e-7 | Parity, if feasible | Yes; EBM has no maintained mainstream ONNX converter, not attempted |
| Sudden-change data rule, sensitivity on simulated episodes | 15 of 30 (0.50), measured against the current ten-activity roster (was 22 of 30 against the five-activity roster this rule was first tuned on) | 0.90 | No |
| Sudden-change data rule, false alarms per stable person-year | 0.30 | 0.5 or less | Yes |
| Time-of-day pattern (Simulated), sensitivity on S8_evening personas over 120 days | 24 of 30 (0.80) | none set | n/a |
| Time-of-day pattern, false positives on stable personas | 0 of 30 | low | Yes |
| Landing page on Lighthouse desktop after the content and capture refresh | performance 1.00, accessibility 1.00, LCP 0.4 s, CLS 0, TBT 0 ms | LCP 2.5 s or less | Yes |
| Landing JavaScript | 242 KB main (75.7 KB gzip) plus 37 KB film chunk (14.2 KB gzip) | 120 KB gzip or less | Yes |
| Mobile critical path | 360,811 bytes | 5 MB or less | Yes |

These numbers describe the simulator, not people. The simulator draws instruments from the same stage variable the model predicts, and the M1 logistic case uses the model's own response form. See `docs/model-card.md`.

## Tests run on 2026-09-22

| Suite | Count | Result |
|---|---|---|
| Unit: contracts 3, core 54, ml 30, sim 9, audio 9, report 9, relay 8, landing 7, app 14, tools 15 | 158 | pass |
| Python, base pipeline (leakage guard, conformal, parity, split by person) | 5 | pass |
| Python, `candidates` dependency group (`uv sync --group candidates`; skipped otherwise) | 6 | pass |
| Browser: app 28, landing 23 | 51 | pass |
| Typecheck, all packages | | clean |
| Avoid-list checker, 14 rules | | no findings |

Not run: any test on an Android device, Lighthouse mobile with throttling (desktop only this pass), TalkBack, iPhone Safari, the GitHub Actions workflow.

## What changed since the last status pass

Built after the sync ladder and five original activities: the doctor report and health-worker visit mode, voice postcards and a shared round of play, a private caregiver check-in that eases non-urgent alerts, an optional PIN or passkey lock on the person's tablet, the time-of-day (sundowning) view, the language-pack manager (English shipped, everything else honestly Planned), the orientation board with a family-approved festival list, and the M2 candidate comparison. Full detail and reasoning is in the branch's commit history. `docs/known-gaps.md` and this file were rewritten to match; earlier drafts of both described a build several features behind this one.
