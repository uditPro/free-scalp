begin;

-- Employer accounts are verified by matching a real business email domain to
-- the company website domain. The server owns all verification decisions.
create table if not exists public.employer_companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  website_url text not null,
  website_domain text not null,
  email_domain text not null,
  description text not null default '' check (char_length(description) <= 4000),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verification_method text,
  verification_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.employer_companies(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  location text not null check (char_length(location) between 2 and 180),
  workplace_type text not null check (workplace_type in ('remote','hybrid','onsite')),
  employment_type text not null check (employment_type in ('full-time','part-time','contract','internship')),
  experience_level text not null check (experience_level in ('entry','mid','senior','lead')),
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(description) between 40 and 20000),
  requirements text not null default '' check (char_length(requirements) <= 12000),
  status text not null default 'draft' check (status in ('draft','published','closed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max is null or salary_min is null or salary_max >= salary_min)
);

create table if not exists public.employer_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.employer_jobs(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_application_id uuid references public.applications(id) on delete set null,
  candidate_name text not null check (char_length(candidate_name) between 1 and 160),
  candidate_email text not null check (char_length(candidate_email) between 3 and 254),
  resume_text text not null check (char_length(resume_text) between 1 and 30000),
  cover_note text not null default '' check (char_length(cover_note) <= 4000),
  status text not null default 'submitted' check (status in ('submitted','reviewing','interview','rejected','hired','withdrawn')),
  employer_note text not null default '' check (char_length(employer_note) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, candidate_user_id)
);

alter table public.saved_jobs add column if not exists employer_job_id uuid references public.employer_jobs(id) on delete set null;

create index if not exists employer_jobs_company_status on public.employer_jobs(company_id, status, published_at desc);
create index if not exists employer_jobs_public on public.employer_jobs(status, published_at desc);
create index if not exists employer_applications_job_created on public.employer_applications(job_id, created_at desc);
create index if not exists employer_applications_candidate_created on public.employer_applications(candidate_user_id, created_at desc);
create index if not exists saved_jobs_employer_job on public.saved_jobs(employer_job_id);
create unique index if not exists saved_jobs_user_employer_job_unique on public.saved_jobs(user_id, employer_job_id) where employer_job_id is not null;

alter table public.employer_companies enable row level security;
alter table public.employer_jobs enable row level security;
alter table public.employer_applications enable row level security;

create policy employer_companies_owner on public.employer_companies
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy employer_jobs_owner on public.employer_jobs
  for all to authenticated
  using (exists (select 1 from public.employer_companies c where c.id = company_id and c.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.employer_companies c where c.id = company_id and c.owner_user_id = (select auth.uid())));

create policy employer_applications_candidate on public.employer_applications
  for select to authenticated
  using ((select auth.uid()) = candidate_user_id);

create policy employer_applications_company on public.employer_applications
  for all to authenticated
  using (exists (
    select 1 from public.employer_jobs j
    join public.employer_companies c on c.id = j.company_id
    where j.id = job_id and c.owner_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.employer_jobs j
    join public.employer_companies c on c.id = j.company_id
    where j.id = job_id and c.owner_user_id = (select auth.uid())
  ));

revoke all on public.employer_companies, public.employer_jobs, public.employer_applications from public, anon, authenticated;
grant all on public.employer_companies, public.employer_jobs, public.employer_applications to service_role;

commit;
