-- Migration: AIR-795 — ECHO demographics new fields + daily reporting table
-- Adds columns to encounter_demographics to capture the new fields
-- introduced in the stakeholder prototype (Lisette, Sentinel app).
-- Also creates daily_reports for zero-report tracking (AC8–AC10).

-- ── 1. New columns on encounter_demographics ─────────────────────────────

alter table public.encounter_demographics
  add column if not exists age_exact        integer,          -- years completed (replaces age_band for ECHO)
  add column if not exists sex_other        boolean default false, -- true when "Other / not stated" is chosen
  add column if not exists insurance_status text
    check (insurance_status in ('no_insurance', 'nhia_or_other') or insurance_status is null),
  add column if not exists distance_from_outlet text
    check (distance_from_outlet in ('under_2km', '2_5km', 'over_5km') or distance_from_outlet is null),
  add column if not exists education_level  text
    check (education_level in ('none_primary', 'secondary', 'tertiary') or education_level is null),
  add column if not exists visit_type       text
    check (visit_type in ('first_visit', 'follow_up') or visit_type is null);

comment on column public.encounter_demographics.age_exact         is 'Patient age in years completed (ECHO anonymous encounters)';
comment on column public.encounter_demographics.insurance_status  is 'no_insurance | nhia_or_other';
comment on column public.encounter_demographics.distance_from_outlet is 'under_2km | 2_5km | over_5km — approximate travel from outlet';
comment on column public.encounter_demographics.education_level   is 'none_primary | secondary | tertiary';
comment on column public.encounter_demographics.visit_type        is 'first_visit | follow_up';

-- Relax the NOT NULL on occupation_type so anonymous ECHO encounters
-- can store one of the new tile values without a separate occupation_type column.
-- (Existing REACH encounters will keep sending a value; ECHO now uses the
--  occupation_type column for Trader/Farmer/Student/Other.)
-- occupation_type is already nullable-equivalent via the trigger —
-- nothing to change there.

-- ── 2. daily_reports — zero-report tracking ───────────────────────────────

create table if not exists public.daily_reports (
  id              uuid        primary key default gen_random_uuid(),
  facility_id     uuid        not null references public.facilities(id) on delete cascade,
  clinician_id    uuid        not null references public.profiles(id)   on delete cascade,
  report_date     date        not null,
  status          text        not null
    check (status in ('no_cases', 'no_report', 'no_report_auto', 'encounter')),
  is_auto_recorded boolean    not null default false,
  -- 7-day follow-up flag set by a scheduled job or the app
  needs_follow_up  boolean    not null default false,
  set_at          timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinician_id, report_date)
);

comment on table  public.daily_reports is 'One row per (clinician, day) capturing their zero-report status. status=encounter means they logged at least one encounter that day.';
comment on column public.daily_reports.is_auto_recorded is 'true when the system filled in no_report_auto at end-of-day because the PPMV did not submit anything';
comment on column public.daily_reports.needs_follow_up  is 'true when >= 7 consecutive days of no_report / no_report_auto';

-- Updated_at trigger
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists daily_reports_set_updated_at on public.daily_reports;
create trigger daily_reports_set_updated_at
  before update on public.daily_reports
  for each row execute function private.set_updated_at();

-- ── 3. RLS for daily_reports ─────────────────────────────────────────────

alter table public.daily_reports enable row level security;

-- Clinicians can read/write their own rows
drop policy if exists daily_reports_own_access on public.daily_reports;
create policy daily_reports_own_access on public.daily_reports
  for all
  using  (clinician_id = auth.uid())
  with check (clinician_id = auth.uid());

-- Facility members can read all rows for their facility
drop policy if exists daily_reports_facility_read on public.daily_reports;
create policy daily_reports_facility_read on public.daily_reports
  for select
  using (private.is_facility_member(facility_id));

-- ── 4. Grants ─────────────────────────────────────────────────────────────

grant select, insert, update on public.daily_reports to authenticated;
