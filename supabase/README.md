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

## Row Level Security and where authorization actually lives

RLS is **enabled on every table with no table policies**, and that combination
is deliberate rather than an oversight.

Nothing in the browser reads or writes these tables. There is no
`supabase.from(...)` anywhere in `src/` — the frontend calls the Express API,
which uses `SUPABASE_SERVICE_ROLE_KEY` and therefore bypasses RLS. So the API is
the access control:

| Route | Who |
|---|---|
| `GET /api/dashboard/analytics` | anyone — but `topStats` and `statusDistribution` only. The per-project series (`investmentVsSaving`, `roiDistribution`, `vendorInvestment`) name machines and vendors and are withheld unless signed in. |
| `GET /api/whoami` | signed in |
| reports: list, create, edit, status | signed in; editing and status changes need ownership, or admin |
| `DELETE /api/roi-reports/:id` | admin only |
| AI routes (`/evaluate`, `/chat`, `/infographic`) | signed in — they cost money per call |
| `POST /api/upload` | signed in |

Enabled-with-no-policies means the anon key published in the browser bundle
(`src/lib/supabase.ts`, used for image upload — `VITE_`-prefixed values are
inlined into the JavaScript by design) can read **nothing at all** from these
tables. It is a backstop behind the API, not the mechanism.

If you ever want the browser to query Supabase directly, that changes: you would
need real policies first, because at that point RLS becomes the only thing
standing between the published key and the data.

## Roles

Two roles, `admin` and `user`, held in `public.users.role` with a check
constraint and a default of `'user'` — so a new signup can never arrive with
privileges, whatever the request body says.

`public.users.auth_user_id` links a row to its Supabase Auth identity. On first
sign-in the API finds the row by `auth_user_id`, or adopts a row matching the
email address (`users.email` is unique and the table predates authentication, so
adoption avoids both a constraint violation and orphaning the reports the
existing row owns), or creates one.

**To make someone an administrator**, edit the table directly — there is no
admin UI by design:

```sql
update public.users set role = 'admin' where email = 'you@laiyih.com';
```

The API re-reads the role on every request, so this takes effect on the next
call rather than when a session expires.

## Storage

`report-images` is a public-read bucket. Uploading requires `authenticated`;
reading does not, because stored reports and exported PDFs reference images by
public URL and gating reads would break images in documents already issued.
Filenames are random, which is obscurity rather than access control — worth
knowing when deciding what may appear in a report photo.

## Not yet wired

`report_embeddings.embedding_vector` is typed `text` and nothing writes to it.
Making semantic search real needs `CREATE EXTENSION vector` (pgvector 0.8.0 is
available but not installed), the column retyped to `vector(1536)` with an
index, and an embedding call on save.
