# ADR-001: speed and scope decisions

Date: 2026-09-21. Status: accepted.

The user asked to finish as fast as possible using the plan, with no datasets that need an application and English only.

| Decision | Plan value | Built value | Reason | Revisit when |
|---|---|---|---|---|
| Local store | SQLite WASM on OPFS (BET-1) | Dexie 4.4.6 behind a `Persistence` interface | Listed fallback; no WebView spike needed | A device spike passes |
| Router | TanStack Router | Small hash router | Fewer moving parts | Route count passes 10 |
| UI primitives | react-aria-components | Native elements with focus and label rules | Speed | Accessibility audit fails |
| i18n | Fluent | Typed English string modules with a tier field per language | English only | A second language reaches Tier 1 |
| Charts | uPlot | SVG charts with table views | Speed, no dependency | Series exceed 2,000 points |
| Contracts | JSON Schema plus generated types | zod 4 schemas with inferred types | Listed fallback in T0.7 | Non-TypeScript consumers appear |
| M2 data | LASI-DAD | Simulator only, tagged Simulated | No applications allowed | A pilot dataset exists |
| Languages | 14 with tiers | English Tier 1, 13 Planned | No native speakers | A reviewer is found |
