-- Applied to the "LY ROI project" Supabase instance on 2026-08-17.
--
-- The rebuilt engine computes cost per pair to four decimals and annual
-- figures to the cent. These columns were `real` (float4, ~7 significant
-- digits), which silently truncated $197,529.23 to $197,529 on the way in.
--
-- `double precision` rather than `numeric`: PostgREST serialises numeric as a
-- JSON *string*, which would arrive in the dashboard as text and break the
-- arithmetic it does on these fields. float8 stays a JSON number and carries
-- 15-17 significant digits, which is far more than these values need.
--
-- The USING clause routes through numeric on purpose. Casting float4 straight
-- to float8 exposes the binary representation of the already-stored value
-- (-9289.64 becomes -9289.6396484375); via numeric it round-trips cleanly.
ALTER TABLE public.roi_reports
  ALTER COLUMN investment_cost    TYPE double precision USING investment_cost::numeric::double precision,
  ALTER COLUMN labor_saving_cost  TYPE double precision USING labor_saving_cost::numeric::double precision,
  ALTER COLUMN energy_saving_cost TYPE double precision USING energy_saving_cost::numeric::double precision,
  ALTER COLUMN other_savings      TYPE double precision USING other_savings::numeric::double precision,
  ALTER COLUMN annual_savings     TYPE double precision USING annual_savings::numeric::double precision,
  ALTER COLUMN annual_output      TYPE double precision USING annual_output::numeric::double precision,
  ALTER COLUMN fob_impact         TYPE double precision USING fob_impact::numeric::double precision,
  ALTER COLUMN roi_months         TYPE double precision USING roi_months::numeric::double precision,
  ALTER COLUMN roi_percentage     TYPE double precision USING roi_percentage::numeric::double precision;

COMMENT ON COLUMN public.roi_reports.form_data IS
  'Project inputs. Holds either the legacy ROIParams shape or the rebuilt ProjectInput, told apart by the _schema marker (roi-matrix/project@1) with a property check as fallback. This is the source of truth: the summary columns beside it are projections recomputed on load, never read back as authoritative.';
