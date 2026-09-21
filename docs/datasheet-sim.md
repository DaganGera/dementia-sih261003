# Datasheet: Hillpath simulator data

Version `sim-0.1`. Every record produced carries `synthetic: true`.

| Question | Answer |
|---|---|
| Why was it made? | To build and test the ability model, the staging pipeline and the sudden-change rule, and to demonstrate them, without any real patient. It is not evidence about people |
| What is in it? | Personas (age, years of schooling, stage, ability per area, decline rate), five instrument scores per person for staging, and game telemetry (trials with design, outcome, response time) over up to a year |
| How is it generated? | `packages/sim`. Ability is a stage mean plus a shared factor and area noise. Trials use a logistic response with a floor at chance (or a probit variant). Practice raises success with a half-life of about five sessions. Scenarios: stable, slow decline, faster decline, depression, delirium episode, hearing loss, non-adherence, evening dip |
| Where do the numbers come from? | Assumed. No value is fitted to a dataset. Instrument means are chosen so lower scores go with later stages and with less schooling, with a person-level effect so adjacent stages overlap. The delirium episode drops ability by up to 2.8 units and recovers over 7 to 30 days |
| Labels | The stage is set by the generator, not by a clinician |
| Known problems | Circular for staging. The M1 logistic case matches the model's own form. Adherence and session timing are simple |
| Allowed uses | Tests, demonstrations, ablations, teaching. Always labelled Simulated |
| Prohibited uses | Reporting accuracy, claiming clinical validity, training a model that is then shown as trained on real data |
| Reproducing | `pnpm --filter "@hillpath/sim" exec tsx src/cli.ts m2-data --n 8000 --out ../../ml/data/sim/m2.jsonl`, then `uv run --project ml python ml/m2_train.py`. Seeds are fixed |
| Maintenance | Parameters live in `packages/sim/src`. A pilot with real data would replace them |
