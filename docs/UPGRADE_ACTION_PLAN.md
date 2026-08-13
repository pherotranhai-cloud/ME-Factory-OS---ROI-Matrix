# LY ROI Matrix — Upgrade Action Plan

**Date:** 2026-08-13
**Scope:** Three requested priorities — (1) ROI calculation accuracy and report clarity, (2) AI-powered analysis, (3) Excel export fidelity (formulas, images, data).
**Status:** Plan for approval. No production code changed yet.

---

## 1. Executive summary

I reviewed the running codebase rather than working from the feature list, and the
headline result is that **priority 1 is not a refinement task — it is a correctness
defect.** The ROI engine currently produces a different investment verdict depending
on how many machines you enter, with no change to any real economics.

Running the shipped `calculateAdvancedROI` with one fixed project and only
`machineQuantity` varying:

| machineQuantity | Manual annual capacity | Manual cost/pair | Machine cost/pair | Annual saving | ROI |
|---|---|---|---|---|---|
| 1 | 299,520 | $0.0291 | $0.0527 | **−$6,926** | never |
| 2 | 299,520 | $0.0582 | $0.0527 | +$3,220 | 372.7 mo |
| 4 | 299,520 | $0.1163 | $0.0527 | **+$74,725** | 32.1 mo |

The manual baseline capacity never moves, but manual cost per pair scales exactly
linearly with quantity. The same proposal flips from a **$6,926/yr loss** to a
**$74,725/yr saving with a 32-month payback** purely by ordering more units. Any
proposal can be made to look good by increasing the quantity field.

Three further points shape the sequencing below:

- **The type-safety net is off.** `@types/react` and `@types/react-dom` are not
  installed, so React ships no declarations and every hook resolves to `any`.
  `npm run lint` reports success while `params.unitPrice` — a property that does not
  exist on `ROIParams` — writes `undefined` to the database on every save. This is
  why the defects below survived. It is fixed first because it is what stops them
  recurring.
- **Production may not run the code being reviewed.** There are three backends:
  `server.ts` (OpenAI + Supabase), `netlify/functions/server.ts` (Gemini + Neon), and
  `src/config/api.ts` which points production traffic at
  `https://ly-roi-matrix-backend.onrender.com/api`. They have drifted apart in model,
  prompt, and request contract. Which one is canonical must be decided before AI work
  starts.
- **The Excel export has no image code at all.** `workbook.addImage` is never called,
  so uploaded machine photos and generated infographics are absent from every
  workbook produced to date.

Recommended sequence: **Phase 0 (foundation) → Priority 1 (ROI) → Priority 3 (Excel)
→ Priority 2 (AI)**. Excel is pulled ahead of AI because it consumes the ROI engine
and can reuse the same fix; AI depends on a backend decision that needs your input.

Estimated effort: **19–24 working days** for one full-time developer.

---

## 2. Phase 0 — Foundation

Prerequisite work. None of the three priorities can be verified without it.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P0-01 | Critical | `@types/react` / `@types/react-dom` missing. React has no bundled declarations, so `useState` and every downstream value infer as `any`. The whole React tree is unchecked. | `node_modules/react` has no `.d.ts`; `params` probes as `any` |
| P0-02 | High | `tsconfig.json` has no `include`/`files` and `strict` is off. Type-checking covers whatever it happens to reach, loosely. | `tsconfig.json` |
| P0-03 | High | No tests and no CI anywhere in the repo. The finance math has no regression guard. | repo-wide |
| P0-04 | High | Three divergent backends; production points at a fourth-party Render host while `netlify.toml` redirects `/api/*` to the Netlify function. | `src/config/api.ts:7`, `netlify.toml`, `server.ts`, `netlify/functions/server.ts` |

**Tasks**

1. Add `@types/react`, `@types/react-dom`. Add `include: ["src", "server.ts", "netlify"]` and enable `strict`. Fix the fallout — expect this to surface a batch of real defects, P1-02 among them.
2. Add Vitest and a `npm test` script. No framework beyond that yet.
3. Add a CI workflow running `lint` + `test` on push to any branch.
4. **Decision required from you:** which backend is canonical? Recommendation is the Express app in `server.ts` deployed once, with `netlify/functions/server.ts` deleted rather than left to drift. See §5.

**Acceptance:** `npm run lint` passes under `strict` with zero errors; `npm test` runs in CI; exactly one backend implementation remains in the repo.

**Effort:** 3–4 days (most of it the strict-mode fallout).

---

## 3. Priority 1 — ROI calculations and report clarity

### 3.1 Calculation correctness

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P1-01 | Critical | Manual baseline capacity scales by `currentManpower`; machine capacity scales by `machineQuantity`. Manual *labor* is then multiplied by `machineQuantity` while manual *output* is not — so manual cost/pair inflates linearly with quantity and every saving is overstated. | `roi-calculations.ts:13,15,30` |
| P1-02 | Critical | `params.unitPrice` does not exist on `ROIParams`. `investment_cost` saves as `undefined` and `roi_percentage` computes as `NaN`. The dashboard's "Total Investment" KPI is therefore permanently $0. | `App.tsx:77,83`; `server.ts:336` |
| P1-03 | High | The app computes payback on **net** investment `(proposed − current) × qty`; the Excel export computes it on **gross** `proposed × qty`. The same project reports two different ROIs. | `roi-calculations.ts:63` vs `excelExport.ts:198` |
| P1-04 | High | `roiMonths` returns `Infinity` when savings ≤ 0. `JSON.stringify` converts it to `null`, and a genuinely loss-making proposal is stored as "no payback" rather than "negative return". | `roi-calculations.ts:64` |
| P1-05 | Medium | Two scrap conventions in one file: good output uses `× (1 − d)`, material gross-up uses `× (1 + d)`. The correct gross-up is `÷ (1 − d)`. At d=10% the error is 1.10 vs 1.111. | `roi-calculations.ts:14,31` vs `52,53` |
| P1-06 | Medium | `DAYS_PER_YEAR = 312` and `POWER_RATE_USD = 0.075` are hardcoded. Energy tariffs differ substantially across the VN / ID / MY sites this tool serves, and neither constant is visible in the UI or the export. | `roi-calculations.ts:4,6` |
| P1-07 | Medium | The dashboard computes an *average* FOB impact and returns it in a field named `totalFOBSavings`. The card label says total. | `server.ts:370,376` |
| P1-08 | Low | Infographic labor reduction uses `currentManpower − proposedManpower`, ignoring `machineQuantity`, so it disagrees with `savings.manpowerSaving`. `roiMonths.toFixed(1)` renders the string `"Infinity"`. | `Infographic.tsx:45,50` |

**Tasks**

1. Restate the baseline explicitly. Define annual capacity for both sides against the **same** production basis, and make `machineQuantity` scale output and cost together. Document which quantity each term is per-machine vs per-line.
2. Fix P1-02 and delete the field, or add `unitPrice` to `ROIParams` if a single headline investment figure is genuinely wanted. Backfill or flag existing rows with `investment_cost IS NULL`.
3. Pick one investment convention (recommend **net incremental**, since the tool compares against an existing state) and use it everywhere — engine, UI, PDF, Excel.
4. Replace `Infinity` with a discriminated result: `{ kind: 'payback', months }` | `{ kind: 'no-payback', annualLoss }`. Render and store both distinctly.
5. Normalise scrap handling to `÷ (1 − d)` throughout.
6. Promote `daysPerYear`, `powerRateUSD`, and `workingHoursPerDay` into `ROIParams`, expose them in an "Assumptions" panel in the form, and print them on every report and export.
7. Correct the dashboard aggregate and its label.
8. **Add unit tests with a golden reference.** At minimum: quantity-invariance (cost/pair must not move with `machineQuantity` when nothing else changes), zero-denominator guards, negative-saving handling, and one worked example signed off by an IE against a manual spreadsheet.

**Acceptance:** the quantity-invariance test passes; the ROI shown in the UI, the PDF, and the workbook are identical for the same input; a loss-making project reports as a loss.

**Effort:** 5–6 days.

### 3.2 Report clarity

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P1-09 | Medium | The evaluation panel renders `cons` and `risks` into a single "Critical Risks" column, collapsing two concepts the prompt deliberately separates. | `AIEvaluation.tsx:59-70` |
| P1-10 | Medium | Every figure is a single point estimate. There is no sensitivity view, no cost-bridge, and no visible assumption set — a reviewer cannot see which input is carrying the result. | `PDFTemplate.tsx`, `ROICalculatorForm.tsx` |

**Tasks**

1. Split cons and risks into their own labelled blocks.
2. Add a cost-per-pair bridge (waterfall) showing labor / material / energy / maintenance / consumables / depreciation contributions between current and proposed. This is the single highest-value clarity addition — it answers "where does the saving come from".
3. Add a one-variable sensitivity strip on the drivers that matter: labor rate, energy tariff, defect rate, utilisation. Show payback at −20% / base / +20%.
4. Put the assumptions panel from §3.1 task 6 on the report itself.
5. Guard the infographic against missing or non-finite values.

**Acceptance:** a reviewer can identify the dominant saving driver and the assumption set without opening the form.

**Effort:** 4–5 days.

---

## 4. Priority 3 — Excel export fidelity

Taken ahead of AI because it consumes the corrected engine directly.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P3-01 | Critical | **No images are exported.** `workbook.addImage` is never called; uploaded machine photos and the generated infographic do not appear in any workbook. | `excelExport.ts` (whole file) |
| P3-02 | Critical | Formula cells are written with no cached `result`, and `calcProperties.fullCalcOnLoad` is not set. Desktop Excel recalculates on open and looks fine — Google Sheets, LibreOffice, Numbers, Excel mobile, and `openpyxl`/`pandas` reads show **blank or zero**. This is the most likely source of the reported "formulas don't survive" behaviour. | `excelExport.ts:125,131,146,152,184,204` |
| P3-03 | High | When a materials list is empty, `startRow` is computed before the rows are added and ends up one greater than `endRow`, emitting a reversed range such as `SUM(H13:H12)`. Excel raises a repair prompt on open. | `excelExport.ts:120,131,143,152` |
| P3-04 | High | The workbook contradicts the app in three places: maintenance and consumables are written per-machine while the engine multiplies by quantity; depreciation omits quantity entirely; investment is gross where the app uses net. | `excelExport.ts:172-174,198` |
| P3-05 | Medium | ROI months formula divides by savings with no guard — `#DIV/0!` whenever savings are zero. | `excelExport.ts:204` |
| P3-06 | Medium | Financials are written as static values from `advancedResults`, so the workbook is a snapshot, not a model. Editing an input in Excel recalculates nothing. | `excelExport.ts:170-191` |
| P3-07 | Medium | Currency formatting is applied via `overviewData[rowNumber - 2]` index arithmetic plus a `property.includes('USD')` string test. Inserting a row silently misformats the sheet. | `excelExport.ts:75-84` |
| P3-08 | Low | No AI evaluation sheet, no savings breakdown, no assumptions sheet, no charts. | `excelExport.ts` |

**Tasks**

1. **Images.** Embed via `workbook.addImage` — machine photos on the Overview sheet and the infographic on a Summary sheet. Fetch Supabase/Cloudinary URLs to a buffer server-side or pass the base64 the app already holds; anchor with `tl`/`ext` so images do not float over data. Cover the data-URI infographic case explicitly.
2. **Formula durability.** For every formula cell write `{ formula, result }` with the engine's computed value cached, **and** set `workbook.calcProperties.fullCalcOnLoad = true`. Add a round-trip test that reads the workbook back with formulas disabled and asserts the cached values match the engine.
3. **Make it a live model.** Put inputs on a dedicated Inputs sheet, give them named ranges, and drive Calculations and Financials from cell references rather than pasted numbers, so an engineer can flex an assumption in Excel and watch the payback move.
4. Fix the empty-range bug by capturing `startRow` after the first row is written, and skip the total row entirely when a list is empty.
5. Wrap the ROI formula in `IFERROR`/`IF(savings<=0, "No payback", …)`.
6. Reconcile every figure against the corrected engine — quantity scaling and net-vs-gross investment.
7. Replace index-arithmetic formatting with per-column format declarations keyed off the column definition.
8. Add Savings Breakdown, AI Evaluation, and Assumptions sheets; add a native Excel chart for the cost-per-pair bridge.
9. Add an export smoke test across an empty-materials project, a zero-savings project, and a fully populated one.

**Acceptance:** a workbook opens without a repair prompt in Excel, Google Sheets, and LibreOffice; every formula shows its correct value in all three; images are present; every figure matches the on-screen report; changing an input on the Inputs sheet updates the payback.

**Effort:** 5–6 days.

---

## 5. Priority 2 — AI-powered analysis

Blocked on the P0-04 backend decision.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| P2-01 | Critical | The chatbot posts to `/api/chat`, which exists only in the Netlify function. It is absent from `server.ts`, so the assistant fails outright in local development. | `AIChatbot.tsx:36`; `server.ts` has no `/api/chat` |
| P2-02 | Critical | The Netlify `/api/evaluate` sends **no system prompt at all** — it forwards the raw user prompt with `responseMimeType: json`. The entire audit rubric, language enforcement, and verdict enum exist only in `server.ts`. Where the Netlify path serves traffic, verdicts will not match the strings the UI styles against, so every result renders in the red "reject" treatment. | `netlify/functions/server.ts:324-341` vs `server.ts:431-467`; `AIEvaluation.tsx:14-15` |
| P2-03 | Critical | Infographic request contracts disagree three ways. The app sends `{params, results}` and expects `{title, keyStats, highlights}`; `server.ts` matches; the Netlify handler expects flat scalar fields and returns a **rendered image**. On the Netlify path every field arrives `undefined`. | `App.tsx:145-148`, `Infographic.tsx:5-9`, `server.ts:476-511`, `netlify/functions/server.ts:400-425` |
| P2-04 | High | Two providers and two models across the two backends (`gpt-5.4-mini-2026-03-17` vs `gemini-3-flash-preview`), with different env vars (`OPENAI_API_KEY` vs `GEMINI_API_KEY`). `.env.example` documents only the OpenAI one. | `server.ts:458`, `netlify/functions/server.ts:332`, `.env.example` |
| P2-05 | High | Model output is parsed and rendered with no schema validation. A missing `keyStats` key crashes the infographic on `.map`. | `Infographic.tsx:62`, `server.ts:469` |
| P2-06 | High | The chat handler selects ten full report rows and interpolates them whole into the system prompt — unbounded token growth and broad over-disclosure of every stored column. | `netlify/functions/server.ts:353,370` |
| P2-07 | Medium | `report_embeddings` is written with `summary_text` only; no embedding vector is ever generated. Semantic retrieval over past projects is scaffolded but non-functional. | `server.ts:182-185,224-229` |
| P2-08 | Medium | The chat persona is hardcoded Vietnamese. `lang` is passed into the component and never used, despite six supported languages. | `netlify/functions/server.ts:362-367`, `AIChatbot.tsx:5` |
| P2-09 | Medium | No timeout, retry, or `max_tokens` on any AI call. A stalled upstream holds the serverless invocation to the platform limit. | `server.ts:457,497`, `netlify/functions/server.ts:331,385` |
| P2-10 | Low | The `initialPrompt` effect can fire twice under React 19 StrictMode; chat history is component-local and is lost on tab switch. | `AIChatbot.tsx:19-24` |

**Tasks**

1. Consolidate onto the single backend chosen in P0-04. Port `/api/chat` into it. Delete the loser rather than leaving it in the tree.
2. Move all three prompts into a shared `src/server/prompts/` module with the full audit rubric, so no route can silently lose it again.
3. Define response schemas once (Zod) and validate every model response server-side. On a validation failure, retry once with the schema echoed back, then return a typed error the UI renders as a real message rather than crashing.
4. Replace the raw-row prompt dump with a compact projection — a whitelist of fields, capped row count, capped characters.
5. Add timeouts, one bounded retry, and explicit token caps on every call.
6. Thread `lang` through the chat route with the same strict language enforcement `/api/evaluate` already uses.
7. Either populate `report_embeddings` with real vectors and query by similarity, or drop the table. Recommendation: **implement it** — "compare against similar past projects" is the strongest AI feature available here, and the schema is already in place.
8. Persist chat history per report; guard the `initialPrompt` effect.
9. Ground the evaluation prompt in the corrected engine output, and have it cite the specific figures it reasons from so an operator can audit the verdict.

**Acceptance:** one backend; identical prompts and output contracts across environments; a malformed model response degrades to a readable message instead of a crash; the assistant works in local development.

**Effort:** 6–8 days.

---

## 6. Sequencing

| Phase | Content | Days | Depends on |
|---|---|---|---|
| 0 | Foundation — types, strict mode, tests, CI, backend decision | 3–4 | your decision on P0-04 |
| 1 | Priority 1a — ROI engine correctness | 5–6 | Phase 0 |
| 2 | Priority 1b — report clarity | 4–5 | Phase 1 |
| 3 | Priority 3 — Excel export | 5–6 | Phase 1 |
| 4 | Priority 2 — AI consolidation and hardening | 6–8 | Phase 0, Phase 1 |

**Total: 19–24 working days** for one full-time developer. Phases 2, 3, and 4 can
overlap across two developers once Phase 1 lands, bringing the calendar to roughly
three weeks.

---

## 7. What I need from you

1. **Backend decision (P0-04)** — blocks Phase 0 and Priority 2. Which of the three
   deployments is real?
2. **Investment convention (P1-03)** — net incremental or gross? This changes every
   published payback figure, including on reports already approved.
3. **An IE sign-off example** — one worked project with a manually verified expected
   output, to anchor the golden test in Phase 1.
4. **Historical data** — some stored reports have `investment_cost` as `undefined`
   and `roi_months` as `null` from P1-02 and P1-04. Confirm whether these should be
   recalculated and backfilled, or left as-is and flagged in the UI.

One thing worth flagging plainly: fixing P1-01 will change the reported ROI on
**every existing project**, and for low-quantity proposals it will move numbers in
the unfavourable direction. Any proposal already approved on the current figures
should be re-run before the corrected version reaches users.
