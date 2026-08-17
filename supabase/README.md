# Database

Schema changes for the `roi_reports` database live in `migrations/`, named with
the timestamp Supabase recorded them under so the folder and the remote
migration history stay in step.

The schema predates this folder: the tables were created directly in the SQL
editor, so `migrations/` starts partway through the story rather than building
the database from nothing. Anything from here on is recorded.

## What the application relies on

`roi_reports.form_data` is the source of truth for a project. It holds one of
two shapes, told apart on read:

| Shape | Marker | Behaviour on load |
|---|---|---|
| `ProjectInput` (rebuilt engine) | `_schema: "roi-matrix/project@1"` | Opens in the analysis workspace as saved |
| `ROIParams` (legacy calculator) | `machineQuantity` present, no `demandPairsPerYear` | Adapted, and flagged in the UI as a restatement |

The flat summary columns beside it — `annual_savings`, `roi_months`,
`investment_cost` and the rest — are **projections, not sources**. Loading a
report ignores them and recomputes from `form_data`. If a stored summary ever
disagrees with a fresh calculation, the calculation is right. They exist so the
dashboard and history list can sort and filter without deserialising every
project.

## Row Level Security

RLS is currently **disabled** on all tables. This is worth understanding before
adding data, because the browser bundle carries a Supabase anon key
(`src/lib/supabase.ts`, used for image upload) and `VITE_`-prefixed values are
inlined into the published JavaScript by design. The anon key is meant to be
public; RLS is what protects the data behind it.

Enabling RLS without policies blocks all access, so it needs policies written
alongside it. The server uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS,
so the API keeps working once it is enabled — only the browser client's storage
upload needs a policy.

## Not yet wired

`report_embeddings.embedding_vector` is typed `text` and nothing writes to it.
Making semantic search real needs `CREATE EXTENSION vector` (pgvector 0.8.0 is
available but not installed), the column retyped to `vector(1536)` with an
index, and an embedding call on save.
