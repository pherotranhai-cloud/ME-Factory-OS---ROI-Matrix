-- Applied to the "LY ROI project" Supabase instance on 2026-08-17.
--
-- Authorization is enforced in the Express layer using the service-role key,
-- which bypasses RLS. RLS therefore stays ON with no table policies on purpose:
-- that combination means the anon key shipped in the browser bundle can read
-- nothing at all, which is the strongest posture available for a key that is
-- public by design.

-- 1. Link application users to Supabase Auth identities.
--    public.users.id stays bigint so the existing roi_reports.user_id foreign
--    key keeps working; the auth identity is carried alongside it.
alter table public.users add column if not exists auth_user_id uuid;

do $$ begin
  alter table public.users
    add constraint users_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null; end $$;

create unique index if not exists users_auth_user_id_key on public.users (auth_user_id);

-- 2. Exactly two roles, defaulting to the least privileged so a new signup can
--    never arrive with elevated rights. The existing 'Operator' row predates
--    this and is normalised down rather than guessed upward.
update public.users set role = 'user' where role is null or role not in ('admin', 'user');
alter table public.users alter column role set default 'user';

do $$ begin
  alter table public.users add constraint users_role_check check (role in ('admin', 'user'));
exception when duplicate_object then null; end $$;

-- 3. Uploads require a login. The previous policy granted INSERT to `public`,
--    so anyone holding the anon key from the published bundle could write files
--    into the bucket without authenticating.
drop policy if exists "Public Uploads" on storage.objects;

create policy "report images: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-images');

-- SELECT stays public: stored reports and exported PDFs reference images by
-- their public URL, so gating reads would break images in already-issued
-- documents. Filenames are random, which is obscurity rather than access
-- control -- worth knowing when deciding what may appear in a report photo.
