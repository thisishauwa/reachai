-- ECHO / REACH Encounter - Supabase Postgres schema
-- Apply as a migration, then generate TypeScript types from the resulting schema.

create extension if not exists pgcrypto;

create type public.app_role as enum ('clinician', 'referral_clinician', 'facility_admin', 'clinical_admin', 'platform_admin');
create type public.workflow_mode as enum ('reach', 'echo');
create type public.privacy_mode as enum ('identified', 'anonymous');
create type public.encounter_status as enum ('draft', 'in_progress', 'completed', 'voided');
create type public.consent_kind as enum ('anonymous_screening', 'identified_screening', 'identified_referral');
create type public.consent_method as enum ('verbal_attestation', 'typed_signature', 'drawn_signature');
create type public.question_type as enum ('boolean', 'severity_0_10', 'integer', 'decimal', 'short_text', 'long_text', 'single_select', 'multi_select');
create type public.triage_severity as enum ('none', 'routine', 'urgent', 'emergency');
create type public.lab_result_type as enum ('binary', 'numeric', 'single_select', 'multi_component');
create type public.referral_status as enum ('created', 'arrived', 'closed', 'cancelled');
create type public.notification_type as enum ('referral_created', 'referral_arrived', 'referral_closed', 'referral_cancelled', 'sync_attention');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  facility_type text,
  timezone text not null default 'Africa/Lagos',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  staff_id text,
  preferred_workflow public.workflow_mode,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facility_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  facility_id uuid not null references public.facilities(id),
  role public.app_role not null default 'clinician',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, facility_id)
);

create or replace function private.is_facility_member(target_facility uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.facility_memberships m
    where m.user_id = auth.uid() and m.facility_id = target_facility and m.is_active
  );
$$;

create or replace function private.has_role(target_facility uuid, allowed public.app_role[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.facility_memberships m
    where m.user_id = auth.uid() and m.facility_id = target_facility
      and m.is_active and m.role = any(allowed)
  );
$$;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  facility_id uuid not null references public.facilities(id),
  patient_code text not null,
  full_name text not null,
  phone_e164 text,
  age_band text not null,
  sex text not null check (sex in ('female', 'male', 'intersex', 'unknown')),
  pregnancy_status text,
  occupation_type text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (facility_id, patient_code)
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  facility_id uuid not null references public.facilities(id),
  clinician_id uuid not null references public.profiles(id),
  patient_id uuid references public.patients(id),
  encounter_code text not null,
  session_code text,
  workflow_mode public.workflow_mode not null,
  privacy_mode public.privacy_mode not null,
  status public.encounter_status not null default 'draft',
  locale text not null default 'en' check (locale in ('en', 'ha')),
  source_device_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, encounter_code),
  check ((privacy_mode = 'identified' and patient_id is not null and session_code is null)
      or (privacy_mode = 'anonymous' and patient_id is null and session_code is not null)),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table public.encounter_demographics (
  encounter_id uuid primary key references public.encounters(id) on delete cascade,
  age_band text not null,
  sex text not null check (sex in ('female', 'male', 'intersex', 'unknown')),
  pregnancy_status text,
  occupation_type text not null,
  -- Identifying fields are snapshots and must be null for anonymous encounters.
  full_name text,
  phone_e164 text,
  patient_code text,
  created_at timestamptz not null default now()
);

create or replace function private.enforce_encounter_privacy()
returns trigger language plpgsql set search_path = public as $$
declare pm public.privacy_mode;
begin
  select privacy_mode into pm from public.encounters where id = new.encounter_id;
  if pm = 'anonymous' and (new.full_name is not null or new.phone_e164 is not null or new.patient_code is not null) then
    raise exception 'Anonymous encounters cannot store patient identifiers';
  end if;
  if pm = 'identified' and new.full_name is null then
    raise exception 'Identified encounters require a patient name snapshot';
  end if;
  return new;
end $$;

create trigger enforce_encounter_demographic_privacy
before insert or update on public.encounter_demographics
for each row execute function private.enforce_encounter_privacy();

create table public.consent_text_versions (
  id uuid primary key default gen_random_uuid(),
  kind public.consent_kind not null,
  version integer not null,
  text_en text not null,
  text_ha text not null,
  effective_from timestamptz not null,
  retired_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id),
  text_version_id uuid not null references public.consent_text_versions(id),
  kind public.consent_kind not null,
  method public.consent_method not null,
  clinician_attested_by uuid references public.profiles(id),
  typed_signer_name text,
  signature_storage_path text,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  check ((method = 'verbal_attestation' and clinician_attested_by is not null and typed_signer_name is null and signature_storage_path is null)
      or (method = 'typed_signature' and typed_signer_name is not null and signature_storage_path is null)
      or (method = 'drawn_signature' and signature_storage_path is not null and typed_signer_name is null))
);

create or replace function private.enforce_consent_privacy()
returns trigger language plpgsql set search_path = public as $$
declare pm public.privacy_mode;
begin
  select privacy_mode into pm from public.encounters where id = new.encounter_id;
  if pm = 'anonymous' and (new.kind <> 'anonymous_screening' or new.method <> 'verbal_attestation') then
    raise exception 'Anonymous encounters allow only verbal anonymous-screening consent';
  end if;
  return new;
end $$;

create trigger enforce_consent_privacy
before insert or update on public.consents
for each row execute function private.enforce_consent_privacy();

create table public.syndromes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_en text not null,
  label_ha text not null,
  audio_storage_path text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.question_sets (
  id uuid primary key default gen_random_uuid(),
  syndrome_id uuid not null references public.syndromes(id),
  version integer not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  effective_from timestamptz,
  retired_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (syndrome_id, version)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets(id),
  code text not null,
  type public.question_type not null,
  prompt_en text not null,
  prompt_ha text not null,
  help_en text,
  help_ha text,
  audio_storage_path text,
  is_required boolean not null default true,
  display_order integer not null,
  validation jsonb not null default '{}'::jsonb,
  show_when jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  unique (question_set_id, code)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  value text not null,
  label_en text not null,
  label_ha text not null,
  display_order integer not null default 0,
  unique (question_id, value)
);

create table public.encounter_syndromes (
  encounter_id uuid primary key references public.encounters(id) on delete cascade,
  syndrome_id uuid not null references public.syndromes(id),
  question_set_id uuid not null references public.question_sets(id),
  selected_at timestamptz not null default now()
);

create table public.encounter_answers (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  value jsonb not null,
  answered_by uuid not null references public.profiles(id),
  answered_at timestamptz not null default now(),
  superseded_at timestamptz,
  client_updated_at timestamptz not null,
  unique (encounter_id, question_id, client_updated_at)
);

create unique index one_active_answer_per_question
on public.encounter_answers(encounter_id, question_id)
where superseded_at is null;

create table public.clinical_notes (
  encounter_id uuid primary key references public.encounters(id) on delete cascade,
  chief_complaint text,
  past_medical_history text,
  physical_examination text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.lab_test_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null default 1,
  name_en text not null,
  name_ha text,
  result_type public.lab_result_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table public.lab_test_components (
  id uuid primary key default gen_random_uuid(),
  lab_test_definition_id uuid not null references public.lab_test_definitions(id),
  code text not null,
  label_en text not null,
  label_ha text,
  result_type public.lab_result_type not null check (result_type <> 'multi_component'),
  unit text,
  reference_range jsonb not null default '{}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  display_order integer not null default 0,
  unique (lab_test_definition_id, code)
);

create table public.encounter_lab_tests (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  lab_test_definition_id uuid not null references public.lab_test_definitions(id),
  ordered_by uuid not null references public.profiles(id),
  ordered_at timestamptz not null default now(),
  status text not null default 'ordered' check (status in ('ordered', 'resulted', 'cancelled'))
);

create table public.encounter_lab_results (
  id uuid primary key default gen_random_uuid(),
  encounter_lab_test_id uuid not null references public.encounter_lab_tests(id) on delete cascade,
  component_id uuid references public.lab_test_components(id),
  value jsonb,
  unit_snapshot text,
  resulted_by uuid references public.profiles(id),
  resulted_at timestamptz,
  unique (encounter_lab_test_id, component_id)
);

create table public.encounter_diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  diagnosis_code text,
  diagnosis_label text not null,
  is_primary boolean not null default false,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now()
);

create table public.treatment_plans (
  encounter_id uuid primary key references public.encounters(id) on delete cascade,
  plan_text text not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  medication_name text not null,
  dose text,
  route text,
  frequency text,
  duration text,
  instructions text,
  prescribed_by uuid not null references public.profiles(id),
  prescribed_at timestamptz not null default now()
);

create table public.triage_rules (
  id uuid primary key default gen_random_uuid(),
  syndrome_id uuid not null references public.syndromes(id),
  version integer not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  priority integer not null default 0,
  condition_code text not null,
  condition_label_en text not null,
  condition_label_ha text,
  severity public.triage_severity not null,
  conditions jsonb not null,
  guidance_en text not null,
  guidance_ha text,
  ipc_guidance_en text,
  ipc_guidance_ha text,
  referral_required boolean not null default false,
  effective_from timestamptz,
  retired_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (syndrome_id, version, condition_code)
);

create table public.triage_outcomes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id),
  triage_rule_id uuid references public.triage_rules(id),
  severity public.triage_severity not null,
  condition_code text,
  condition_label_en text,
  condition_label_ha text,
  guidance_en text,
  guidance_ha text,
  ipc_guidance_en text,
  ipc_guidance_ha text,
  referral_required boolean not null default false,
  evaluated_inputs jsonb not null,
  ruleset_snapshot jsonb not null,
  evaluated_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  override_reason text
);

create index triage_outcomes_encounter_recent_idx on public.triage_outcomes(encounter_id, evaluated_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  encounter_id uuid not null unique references public.encounters(id),
  triage_outcome_id uuid not null references public.triage_outcomes(id),
  source_facility_id uuid not null references public.facilities(id),
  destination_facility_id uuid not null references public.facilities(id),
  patient_id uuid references public.patients(id),
  consent_id uuid references public.consents(id),
  privacy_mode public.privacy_mode not null,
  referral_code text not null unique,
  status public.referral_status not null default 'created',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  arrived_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  check ((privacy_mode = 'anonymous' and patient_id is null and consent_id is null)
      or (privacy_mode = 'identified' and patient_id is not null and consent_id is not null)),
  check (source_facility_id <> destination_facility_id)
);

-- Composite tenant keys prevent cross-organization/facility references even if a UUID is known.
alter table public.facilities add constraint facilities_tenant_key unique (id, organization_id);
alter table public.patients add constraint patients_tenant_key unique (id, organization_id, facility_id);
alter table public.facility_memberships add constraint membership_facility_tenant_fk
  foreign key (facility_id, organization_id) references public.facilities(id, organization_id);
alter table public.patients add constraint patient_facility_tenant_fk
  foreign key (facility_id, organization_id) references public.facilities(id, organization_id);
alter table public.encounters add constraint encounter_facility_tenant_fk
  foreign key (facility_id, organization_id) references public.facilities(id, organization_id);
alter table public.encounters add constraint encounter_patient_tenant_fk
  foreign key (patient_id, organization_id, facility_id)
  references public.patients(id, organization_id, facility_id);
alter table public.referrals add constraint referral_source_tenant_fk
  foreign key (source_facility_id, organization_id) references public.facilities(id, organization_id);
alter table public.referrals add constraint referral_destination_tenant_fk
  foreign key (destination_facility_id, organization_id) references public.facilities(id, organization_id);

create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  from_status public.referral_status,
  to_status public.referral_status not null,
  reason text,
  actor_id uuid not null references public.profiles(id),
  facility_id uuid not null references public.facilities(id),
  occurred_at timestamptz not null default now(),
  idempotency_key uuid not null unique
);

create table public.incentive_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  version integer not null,
  name text not null,
  conditions jsonb not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  effective_from timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, version)
);

create table public.incentive_evaluations (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referrals(id),
  incentive_rule_id uuid not null references public.incentive_rules(id),
  eligible boolean not null,
  reason text,
  closure_seconds bigint,
  evaluated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.client_mutations (
  idempotency_key uuid primary key,
  user_id uuid not null references public.profiles(id),
  device_id uuid not null,
  entity_type text not null,
  entity_id uuid,
  operation text not null,
  request_hash text not null,
  response jsonb,
  processed_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  facility_id uuid references public.facilities(id),
  purpose text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index patients_facility_created_idx on public.patients(facility_id, created_at desc);
create index patients_name_search_idx on public.patients using gin (to_tsvector('simple', full_name));
create index encounters_facility_recent_idx on public.encounters(facility_id, started_at desc);
create index encounters_patient_idx on public.encounters(patient_id, started_at desc);
create index answers_encounter_idx on public.encounter_answers(encounter_id) where superseded_at is null;
create index referrals_source_recent_idx on public.referrals(source_facility_id, created_at desc);
create index referrals_destination_status_idx on public.referrals(destination_facility_id, status, created_at desc);
create index referral_events_timeline_idx on public.referral_events(referral_id, occurred_at);
create index notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index audit_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);

create or replace function private.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger patients_updated_at before update on public.patients for each row execute function private.set_updated_at();
create trigger encounters_updated_at before update on public.encounters for each row execute function private.set_updated_at();
create trigger treatment_plans_updated_at before update on public.treatment_plans for each row execute function private.set_updated_at();

create or replace function private.reject_completed_encounter_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'completed' then
    raise exception 'Completed encounters are immutable';
  end if;
  return new;
end $$;

create trigger encounters_lock_after_completion
before update on public.encounters
for each row execute function private.reject_completed_encounter_update();

create or replace function private.require_open_encounter()
returns trigger language plpgsql set search_path = public as $$
declare payload jsonb;
declare eid uuid;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  eid := (payload ->> tg_argv[0])::uuid;
  if exists (select 1 from public.encounters e where e.id = eid and e.status = 'completed') then
    raise exception 'Completed encounter data is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger demographics_require_open before insert or update or delete on public.encounter_demographics
for each row execute function private.require_open_encounter('encounter_id');
create trigger consents_require_open before insert or update or delete on public.consents
for each row execute function private.require_open_encounter('encounter_id');
create trigger syndrome_require_open before insert or update or delete on public.encounter_syndromes
for each row execute function private.require_open_encounter('encounter_id');
create trigger answers_require_open before insert or update or delete on public.encounter_answers
for each row execute function private.require_open_encounter('encounter_id');
create trigger notes_require_open before insert or update or delete on public.clinical_notes
for each row execute function private.require_open_encounter('encounter_id');
create trigger labs_require_open before insert or update or delete on public.encounter_lab_tests
for each row execute function private.require_open_encounter('encounter_id');
create trigger diagnoses_require_open before insert or update or delete on public.encounter_diagnoses
for each row execute function private.require_open_encounter('encounter_id');
create trigger treatment_require_open before insert or update or delete on public.treatment_plans
for each row execute function private.require_open_encounter('encounter_id');
create trigger prescriptions_require_open before insert or update or delete on public.prescriptions
for each row execute function private.require_open_encounter('encounter_id');
create trigger triage_require_open before insert or update or delete on public.triage_outcomes
for each row execute function private.require_open_encounter('encounter_id');

-- RLS: deny by default, then grant only explicit facility/self access.
alter table public.organizations enable row level security;
alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.facility_memberships enable row level security;
alter table public.patients enable row level security;
alter table public.encounters enable row level security;
alter table public.encounter_demographics enable row level security;
alter table public.consent_text_versions enable row level security;
alter table public.consents enable row level security;
alter table public.syndromes enable row level security;
alter table public.question_sets enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.encounter_syndromes enable row level security;
alter table public.encounter_answers enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.lab_test_definitions enable row level security;
alter table public.lab_test_components enable row level security;
alter table public.encounter_lab_tests enable row level security;
alter table public.encounter_lab_results enable row level security;
alter table public.encounter_diagnoses enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.prescriptions enable row level security;
alter table public.triage_rules enable row level security;
alter table public.triage_outcomes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_events enable row level security;
alter table public.incentive_rules enable row level security;
alter table public.incentive_evaluations enable row level security;
alter table public.notifications enable row level security;
alter table public.client_mutations enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self on public.profiles for select using (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy memberships_select_self on public.facility_memberships for select using (user_id = auth.uid());

create policy facilities_select_member on public.facilities for select
using (private.is_facility_member(id));
create policy organizations_select_member on public.organizations for select
using (exists (select 1 from public.facility_memberships m where m.user_id = auth.uid() and m.organization_id = organizations.id and m.is_active));

create policy patients_member_select on public.patients for select using (private.is_facility_member(facility_id));
create policy patients_member_insert on public.patients for insert
with check (private.is_facility_member(facility_id) and created_by = auth.uid());
create policy patients_member_update on public.patients for update
using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));
create policy encounters_member_select on public.encounters for select using (private.is_facility_member(facility_id));
create policy encounters_member_insert on public.encounters for insert with check (private.is_facility_member(facility_id) and clinician_id = auth.uid());
create policy encounters_owner_update on public.encounters for update using (clinician_id = auth.uid() and private.is_facility_member(facility_id))
with check (clinician_id = auth.uid() and private.is_facility_member(facility_id));

-- Child-table access follows the encounter facility. Reuse this shape for clinical children.
create or replace function private.can_access_encounter(target_encounter uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.encounters e where e.id = target_encounter and private.is_facility_member(e.facility_id));
$$;

create policy demographics_encounter_access on public.encounter_demographics for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy consents_encounter_access on public.consents for select using (private.can_access_encounter(encounter_id));
create policy consents_encounter_insert on public.consents for insert with check (private.can_access_encounter(encounter_id));
create policy encounter_syndromes_access on public.encounter_syndromes for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy answers_access on public.encounter_answers for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id) and answered_by = auth.uid());
create policy notes_access on public.clinical_notes for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id) and updated_by = auth.uid());
create policy encounter_labs_access on public.encounter_lab_tests for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy lab_results_access on public.encounter_lab_results for all
using (exists (select 1 from public.encounter_lab_tests t where t.id = encounter_lab_test_id and private.can_access_encounter(t.encounter_id)))
with check (exists (select 1 from public.encounter_lab_tests t where t.id = encounter_lab_test_id and private.can_access_encounter(t.encounter_id)));
create policy diagnoses_access on public.encounter_diagnoses for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy treatment_access on public.treatment_plans for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy prescriptions_access on public.prescriptions for all
using (private.can_access_encounter(encounter_id)) with check (private.can_access_encounter(encounter_id));
create policy triage_outcomes_select on public.triage_outcomes for select using (private.can_access_encounter(encounter_id));

-- Published clinical reference data is readable to authenticated users.
create policy consent_text_read on public.consent_text_versions for select to authenticated using (effective_from <= now() and (retired_at is null or retired_at > now()));
create policy syndromes_read on public.syndromes for select to authenticated using (is_active);
create policy question_sets_read on public.question_sets for select to authenticated using (status = 'published' and effective_from <= now() and (retired_at is null or retired_at > now()));
create policy questions_read on public.questions for select to authenticated
using (is_active and exists (
  select 1 from public.question_sets qs where qs.id = question_set_id and qs.status = 'published'
    and qs.effective_from <= now() and (qs.retired_at is null or qs.retired_at > now())
));
create policy options_read on public.question_options for select to authenticated
using (exists (
  select 1 from public.questions q join public.question_sets qs on qs.id = q.question_set_id
  where q.id = question_id and q.is_active and qs.status = 'published'
    and qs.effective_from <= now() and (qs.retired_at is null or qs.retired_at > now())
));
create policy lab_defs_read on public.lab_test_definitions for select to authenticated using (is_active);
create policy lab_components_read on public.lab_test_components for select to authenticated using (true);
create policy triage_rules_read on public.triage_rules for select to authenticated using (status = 'published' and effective_from <= now() and (retired_at is null or retired_at > now()));

create or replace function private.can_access_referral(target_referral uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.referrals r
    where r.id = target_referral
      and (private.is_facility_member(r.source_facility_id) or private.is_facility_member(r.destination_facility_id))
  );
$$;

create policy referrals_participant_select on public.referrals for select
using (private.is_facility_member(source_facility_id) or private.is_facility_member(destination_facility_id));
-- Inserts and transitions should go through privileged transactional functions, not direct client writes.
create policy referral_events_participant_select on public.referral_events for select using (private.can_access_referral(referral_id));
create policy incentive_eval_participant_select on public.incentive_evaluations for select
using (private.can_access_referral(referral_id));
create policy notifications_self_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mutations_self_select on public.client_mutations for select using (user_id = auth.uid());

-- No client policies are intentionally defined for membership/role writes, reference-data writes,
-- triage writes, referral writes, incentive rules, mutation inserts, or audit logs. Use audited
-- server-side functions/service-role code for those operations.

-- Storage setup. Create bucket records idempotently.
insert into storage.buckets (id, name, public)
values ('consent-signatures', 'consent-signatures', false),
       ('clinical-audio', 'clinical-audio', false)
on conflict (id) do nothing;

-- Signatures are uploaded through a trusted signed-upload server flow after consent ID allocation.
-- Audio is authenticated-read. Clinical-admin writes should be handled by privileged admin tooling.
create policy clinical_audio_authenticated_read on storage.objects for select to authenticated
using (bucket_id = 'clinical-audio');

-- Recommended grants. RLS still applies.
grant usage on schema public to authenticated;
grant select, insert, update on public.patients, public.encounters, public.encounter_demographics,
  public.consents, public.encounter_syndromes, public.encounter_answers, public.clinical_notes,
  public.encounter_lab_tests, public.encounter_lab_results, public.encounter_diagnoses,
  public.treatment_plans, public.prescriptions to authenticated;
grant select on public.organizations, public.facilities, public.profiles, public.facility_memberships,
  public.consent_text_versions, public.syndromes, public.question_sets, public.questions,
  public.question_options, public.lab_test_definitions, public.lab_test_components,
  public.triage_rules, public.triage_outcomes, public.referrals, public.referral_events,
  public.incentive_evaluations, public.notifications, public.client_mutations to authenticated;
grant update (display_name, preferred_workflow) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- IMPORTANT: implement evaluate_triage, create_referral and transition_referral as reviewed,
-- transactional server functions/Edge Functions. They must validate auth.uid(), membership,
-- consent, legal state transitions and idempotency, and write audit_logs.
-- ECHO / REACH Encounter - transactional server functions
-- Implements evaluate_triage, create_referral and transition_referral as
-- security-definer Postgres functions (callable via supabase.rpc from trusted
-- server code / route handlers only -- never with the anon/service key exposed
-- to the browser). Each function is idempotent via public.client_mutations.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.severity_rank(s public.triage_severity)
returns integer language sql immutable as $$
  select case s
    when 'emergency' then 3
    when 'urgent' then 2
    when 'routine' then 1
    else 0
  end;
$$;

-- Generates a non-sequential, human-readable referral code, e.g. REF-2582-JFH.
create or replace function private.generate_referral_code()
returns text language plpgsql as $$
declare
  digits text;
  letters text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  attempt int := 0;
begin
  loop
    digits := lpad((floor(random() * 10000))::int::text, 4, '0');
    letters := '';
    for i in 1..3 loop
      letters := letters || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    candidate := 'REF-' || digits || '-' || letters;
    attempt := attempt + 1;
    if not exists (select 1 from public.referrals r where r.referral_code = candidate) then
      return candidate;
    end if;
    if attempt > 25 then
      raise exception 'Unable to generate a unique referral code';
    end if;
  end loop;
end;
$$;

-- Evaluates a single triage_rules.conditions clause list against a map of
-- question_code -> answer value. conditions is a jsonb array of objects:
--   {"question_code": "IS_DEHYDRATED", "op": "eq", "value": true}
--   {"question_code": "DEHYDRATION_SEVERITY", "op": "gte", "value": 7}
-- Supported ops: eq, neq, gte, lte, gt, lt, in, is_true, is_true, answered.
-- All clauses in the array are combined with AND.
create or replace function private.evaluate_conditions(conditions jsonb, inputs jsonb)
returns boolean language plpgsql immutable as $$
declare
  clause jsonb;
  code text;
  op text;
  expected jsonb;
  actual jsonb;
begin
  if conditions is null or jsonb_typeof(conditions) <> 'array' then
    return false;
  end if;
  for clause in select * from jsonb_array_elements(conditions) loop
    code := clause ->> 'question_code';
    op := coalesce(clause ->> 'op', 'eq');
    expected := clause -> 'value';
    actual := inputs -> code;

    if op = 'answered' then
      if actual is null then return false; end if;
      continue;
    end if;

    if actual is null then
      return false;
    end if;

    case op
      when 'eq' then
        if actual <> expected then return false; end if;
      when 'neq' then
        if actual = expected then return false; end if;
      when 'gte' then
        if (actual)::text::numeric < (expected)::text::numeric then return false; end if;
      when 'lte' then
        if (actual)::text::numeric > (expected)::text::numeric then return false; end if;
      when 'gt' then
        if (actual)::text::numeric <= (expected)::text::numeric then return false; end if;
      when 'lt' then
        if (actual)::text::numeric >= (expected)::text::numeric then return false; end if;
      when 'in' then
        if not (expected ? (actual #>> '{}')) then return false; end if;
      when 'is_true' then
        if actual::text <> 'true' then return false; end if;
      when 'is_false' then
        if actual::text <> 'false' then return false; end if;
      else
        raise exception 'Unsupported condition operator: %', op;
    end case;
  end loop;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- evaluate_triage
-- ---------------------------------------------------------------------------

create or replace function public.evaluate_triage(p_encounter_id uuid, p_idempotency_key uuid)
returns public.triage_outcomes
language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_encounter record;
  v_syndrome_id uuid;
  v_inputs jsonb := '{}'::jsonb;
  v_rules jsonb := '[]'::jsonb;
  v_rule record;
  v_outcome public.triage_outcomes;
  v_answer_ids jsonb;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  select * into v_existing from public.client_mutations where idempotency_key = p_idempotency_key;
  if found then
    return (select t.* from public.triage_outcomes t where t.id = (v_existing.response ->> 'outcome_id')::uuid);
  end if;

  select * into v_encounter from public.encounters where id = p_encounter_id;
  if v_encounter.workflow_mode <> 'echo' then
    raise exception 'Triage is only evaluated for ECHO encounters';
  end if;
  if v_encounter.status = 'completed' then
    raise exception 'Completed encounters are immutable';
  end if;

  select syndrome_id into v_syndrome_id from public.encounter_syndromes where encounter_id = p_encounter_id;
  if v_syndrome_id is null then
    raise exception 'Encounter has no selected syndrome';
  end if;

  select coalesce(jsonb_object_agg(q.code, a.value), '{}'::jsonb),
         coalesce(jsonb_agg(a.id), '[]'::jsonb)
  into v_inputs, v_answer_ids
  from public.encounter_answers a
  join public.questions q on q.id = a.question_id
  where a.encounter_id = p_encounter_id and a.superseded_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rule_id', r.id, 'version', r.version, 'condition_code', r.condition_code,
           'severity', r.severity, 'priority', r.priority
         ) order by r.priority desc), '[]'::jsonb)
  into v_rules
  from public.triage_rules r
  where r.syndrome_id = v_syndrome_id and r.status = 'published'
    and r.effective_from <= now() and (r.retired_at is null or r.retired_at > now());

  v_outcome := null;
  for v_rule in
    select r.* from public.triage_rules r
    where r.syndrome_id = v_syndrome_id and r.status = 'published'
      and r.effective_from <= now() and (r.retired_at is null or r.retired_at > now())
    order by private.severity_rank(r.severity) desc, r.priority desc
  loop
    if private.evaluate_conditions(v_rule.conditions, v_inputs) then
      insert into public.triage_outcomes (
        encounter_id, triage_rule_id, severity, condition_code, condition_label_en, condition_label_ha,
        guidance_en, guidance_ha, ipc_guidance_en, ipc_guidance_ha, referral_required,
        evaluated_inputs, ruleset_snapshot
      ) values (
        p_encounter_id, v_rule.id, v_rule.severity, v_rule.condition_code, v_rule.condition_label_en, v_rule.condition_label_ha,
        v_rule.guidance_en, v_rule.guidance_ha, v_rule.ipc_guidance_en, v_rule.ipc_guidance_ha, v_rule.referral_required,
        jsonb_build_object('answer_ids', v_answer_ids, 'inputs', v_inputs),
        v_rules
      ) returning * into v_outcome;
      exit;
    end if;
  end loop;

  if v_outcome is null then
    insert into public.triage_outcomes (
      encounter_id, severity, evaluated_inputs, ruleset_snapshot, referral_required
    ) values (
      p_encounter_id, 'none', jsonb_build_object('answer_ids', v_answer_ids, 'inputs', v_inputs), v_rules, false
    ) returning * into v_outcome;
  end if;

  insert into public.client_mutations (idempotency_key, user_id, device_id, entity_type, entity_id, operation, request_hash, response)
  values (p_idempotency_key, auth.uid(), coalesce(v_encounter.source_device_id, gen_random_uuid()), 'triage_outcome', v_outcome.id, 'evaluate_triage',
          md5(p_encounter_id::text), jsonb_build_object('outcome_id', v_outcome.id));

  return v_outcome;
end;
$$;

grant execute on function public.evaluate_triage(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_referral
-- ---------------------------------------------------------------------------

create or replace function public.create_referral(
  p_encounter_id uuid,
  p_destination_facility_id uuid,
  p_privacy_mode public.privacy_mode,
  p_consent_id uuid,
  p_idempotency_key uuid
) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_encounter record;
  v_outcome record;
  v_code text;
  v_referral public.referrals;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  select * into v_existing from public.client_mutations where idempotency_key = p_idempotency_key;
  if found then
    return (select r.* from public.referrals r where r.id = (v_existing.response ->> 'referral_id')::uuid);
  end if;

  -- Idempotent on encounter too: an encounter can only ever generate one referral.
  select * into v_referral from public.referrals where encounter_id = p_encounter_id;
  if found then
    return v_referral;
  end if;

  select * into v_encounter from public.encounters where id = p_encounter_id;
  if v_encounter.workflow_mode <> 'echo' then
    raise exception 'Referrals are generated from ECHO encounters';
  end if;
  if p_privacy_mode <> v_encounter.privacy_mode then
    raise exception 'Referral privacy mode must match the encounter privacy mode';
  end if;
  if not private.is_facility_member(p_destination_facility_id) and v_encounter.privacy_mode = 'identified' then
    -- destination need not be the caller's facility; only source membership is required to create.
    null;
  end if;
  if p_destination_facility_id = v_encounter.facility_id then
    raise exception 'Destination facility must differ from the source facility';
  end if;

  select * into v_outcome from public.triage_outcomes t
  where t.encounter_id = p_encounter_id order by t.evaluated_at desc limit 1;
  if not found then
    raise exception 'A triage outcome is required before creating a referral';
  end if;
  if v_outcome.severity = 'emergency' and v_outcome.acknowledged_at is null and v_outcome.override_reason is null then
    raise exception 'Emergency guidance must be acknowledged before creating a referral';
  end if;

  if p_privacy_mode = 'identified' then
    if p_consent_id is null then
      raise exception 'Identified referrals require a valid consent record';
    end if;
    if not exists (
      select 1 from public.consents c
      where c.id = p_consent_id and c.encounter_id = p_encounter_id and c.revoked_at is null
    ) then
      raise exception 'Consent is missing, revoked, or does not belong to this encounter';
    end if;
  else
    if p_consent_id is not null then
      raise exception 'Anonymous referrals must not reference a consent record';
    end if;
  end if;

  v_code := private.generate_referral_code();

  insert into public.referrals (
    organization_id, encounter_id, triage_outcome_id, source_facility_id, destination_facility_id,
    patient_id, consent_id, privacy_mode, referral_code, created_by
  ) values (
    v_encounter.organization_id, p_encounter_id, v_outcome.id, v_encounter.facility_id, p_destination_facility_id,
    case when p_privacy_mode = 'identified' then v_encounter.patient_id else null end,
    p_consent_id, p_privacy_mode, v_code, auth.uid()
  ) returning * into v_referral;

  insert into public.referral_events (referral_id, from_status, to_status, actor_id, facility_id, idempotency_key)
  values (v_referral.id, null, 'created', auth.uid(), v_encounter.facility_id, p_idempotency_key);

  insert into public.notifications (user_id, type, payload)
  select m.user_id, 'referral_created', jsonb_build_object('referral_id', v_referral.id, 'referral_code', v_referral.referral_code)
  from public.facility_memberships m
  where m.facility_id = p_destination_facility_id and m.is_active;

  insert into public.client_mutations (idempotency_key, user_id, device_id, entity_type, entity_id, operation, request_hash, response)
  values (p_idempotency_key, auth.uid(), coalesce(v_encounter.source_device_id, gen_random_uuid()), 'referral', v_referral.id, 'create_referral',
          md5(p_encounter_id::text || p_destination_facility_id::text), jsonb_build_object('referral_id', v_referral.id));

  return v_referral;
end;
$$;

grant execute on function public.create_referral(uuid, uuid, public.privacy_mode, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- transition_referral
-- ---------------------------------------------------------------------------

create or replace function public.transition_referral(
  p_referral_id uuid,
  p_to_status public.referral_status,
  p_reason text,
  p_idempotency_key uuid
) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_referral public.referrals;
  v_actor_facility uuid;
  v_from public.referral_status;
  v_incentive_rule record;
  v_eligible boolean;
  v_closure_seconds bigint;
begin
  select * into v_existing from public.client_mutations where idempotency_key = p_idempotency_key;
  if found then
    return (select r.* from public.referrals r where r.id = (v_existing.response ->> 'referral_id')::uuid);
  end if;

  select * into v_referral from public.referrals where id = p_referral_id for update;
  if not found then
    raise exception 'Referral not found';
  end if;

  if not (private.is_facility_member(v_referral.source_facility_id) or private.is_facility_member(v_referral.destination_facility_id)) then
    raise exception 'Not authorized for this referral';
  end if;

  v_from := v_referral.status;

  if p_to_status = 'arrived' then
    if v_from <> 'created' then raise exception 'Only a Created referral can be marked Arrived'; end if;
    if not private.is_facility_member(v_referral.destination_facility_id) then
      raise exception 'Only destination facility staff may confirm arrival';
    end if;
  elsif p_to_status = 'closed' then
    if v_from <> 'arrived' then raise exception 'A referral must be Arrived before it can be Closed'; end if;
    if not private.is_facility_member(v_referral.destination_facility_id) then
      raise exception 'Only destination facility staff may close a referral';
    end if;
  elsif p_to_status = 'cancelled' then
    if v_from not in ('created', 'arrived') then raise exception 'Closed referrals cannot be cancelled'; end if;
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'Cancellation requires a reason';
    end if;
  else
    raise exception 'Unsupported transition target: %', p_to_status;
  end if;

  update public.referrals set
    status = p_to_status,
    arrived_at = case when p_to_status = 'arrived' then now() else arrived_at end,
    closed_at = case when p_to_status = 'closed' then now() else closed_at end,
    cancelled_at = case when p_to_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_to_status = 'cancelled' then p_reason else cancellation_reason end
  where id = p_referral_id
  returning * into v_referral;

  insert into public.referral_events (referral_id, from_status, to_status, reason, actor_id, facility_id, idempotency_key)
  values (p_referral_id, v_from, p_to_status,
          case when p_to_status = 'cancelled' then p_reason else null end,
          auth.uid(),
          case when private.is_facility_member(v_referral.destination_facility_id) then v_referral.destination_facility_id else v_referral.source_facility_id end,
          p_idempotency_key);

  if p_to_status = 'closed' then
    select * into v_incentive_rule from public.incentive_rules ir
    where ir.organization_id = v_referral.organization_id and ir.status = 'published'
      and ir.effective_from <= now() and (ir.retired_at is null or ir.retired_at > now())
    order by ir.version desc limit 1;

    if found then
      v_closure_seconds := extract(epoch from (now() - v_referral.created_at))::bigint;
      v_eligible := (v_referral.arrived_at is not null) and (v_referral.closed_at is not null)
        and (
          (v_incentive_rule.conditions ->> 'max_closure_seconds') is null
          or v_closure_seconds <= (v_incentive_rule.conditions ->> 'max_closure_seconds')::bigint
        );
      insert into public.incentive_evaluations (referral_id, incentive_rule_id, eligible, reason, closure_seconds)
      values (p_referral_id, v_incentive_rule.id, v_eligible,
              case when v_eligible then 'Closure conditions met' else 'Closure conditions not met' end,
              v_closure_seconds);
    end if;
  end if;

  insert into public.notifications (user_id, type, payload)
  select m.user_id,
    (case p_to_status when 'arrived' then 'referral_arrived' when 'closed' then 'referral_closed' else 'referral_cancelled' end)::public.notification_type,
    jsonb_build_object('referral_id', v_referral.id, 'referral_code', v_referral.referral_code)
  from public.facility_memberships m
  where m.facility_id in (v_referral.source_facility_id, v_referral.destination_facility_id) and m.is_active;

  insert into public.client_mutations (idempotency_key, user_id, device_id, entity_type, entity_id, operation, request_hash, response)
  values (p_idempotency_key, auth.uid(), gen_random_uuid(), 'referral', v_referral.id, 'transition_referral',
          md5(p_referral_id::text || p_to_status::text), jsonb_build_object('referral_id', v_referral.id));

  return v_referral;
end;
$$;

grant execute on function public.transition_referral(uuid, public.referral_status, text, uuid) to authenticated;
-- The base migration's `facilities_select_member` policy only lets a user
-- see facilities they already belong to. That is too strict for referral
-- creation, which requires choosing a destination REACH facility the
-- clinician is *not* a member of. Facility name/code/type are not sensitive,
-- so we additionally allow any active facility within the same organization
-- to be listed (still deny-by-default across organizations).
create policy facilities_select_same_org on public.facilities for select
using (
  exists (
    select 1 from public.facility_memberships m
    where m.user_id = auth.uid()
      and m.organization_id = facilities.organization_id
      and m.is_active
  )
);
-- ECHO / REACH Encounter - non-production demo seed
-- Apply only after ECHO_REACH_Supabase_Migration.sql.
-- This seeds UI reference data visible in the supplied mockups.
-- It intentionally does NOT seed clinical triage thresholds or treatment guidance;
-- those require review and approval by the clinical governance owner.

insert into public.syndromes (code, label_en, label_ha, display_order)
values
  ('FEVER_RASH', 'Fever with rash', 'Zazzabi da kurji', 10),
  ('ACUTE_WATERY_DIARRHOEA', 'Acute watery diarrhoea', 'Gudawa mai ruwa-ruwa', 20),
  ('FEVER_BLEEDING', 'Fever with bleeding', 'Zazzabi da zubar jini', 30),
  ('FEVER_NECK_STIFFNESS', 'Fever with neck stiffness', 'Zazzabi da taurin wuya', 40),
  ('ACUTE_FLACCID_PARALYSIS', 'Acute flaccid paralysis', 'Sanyin kafa ko hannu na gaggawa', 50),
  ('ACUTE_RESPIRATORY_ILLNESS', 'Acute respiratory illness', 'Ciwon numfashi na gaggawa', 60),
  ('JAUNDICE', 'Jaundice', 'Ciwon shawara', 70),
  ('COUGH_OVER_TWO_WEEKS', 'Cough for more than two weeks', 'Tari na mako 2 ko fiye', 80),
  ('NEONATAL_DANGER_SIGNS', 'Neonatal danger signs', 'Alamomin hadari ga jariri', 90),
  ('OTHER_PRIORITY', 'Other priority syndrome', 'Sauran cututtuka masu mahimmanci', 100)
on conflict (code) do update set
  label_en = excluded.label_en,
  label_ha = excluded.label_ha,
  display_order = excluded.display_order,
  is_active = true;

with syndrome as (
  select id from public.syndromes where code = 'FEVER_RASH'
), inserted as (
  insert into public.question_sets (syndrome_id, version, status, effective_from)
  select id, 1, 'published', now() from syndrome
  on conflict (syndrome_id, version) do update set status = 'published'
  returning id
)
insert into public.questions
  (question_set_id, code, type, prompt_en, prompt_ha, display_order)
select inserted.id, q.code, 'boolean'::public.question_type, q.en, q.ha, q.ord
from inserted cross join (values
  ('HAS_COUGH', 'Does the patient have a cough?', 'Shin majiyyacin yana tari?', 10),
  ('HAS_RUNNY_NOSE', 'Does the patient have a runny nose?', 'Shin majiyyacin yana majina?', 20),
  ('HAS_RED_EYES', 'Are the patient''s eyes red?', 'Shin idanun majiyyacin sun yi ja?', 30),
  ('HAS_SWOLLEN_NODES', 'Are the lymph nodes swollen (neck or behind the ears)?', 'Shin akwai kumburi a wuya ko bayan kunne?', 40)
) as q(code, en, ha, ord)
on conflict (question_set_id, code) do update set
  prompt_en = excluded.prompt_en, prompt_ha = excluded.prompt_ha,
  display_order = excluded.display_order, is_active = true;

with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
), inserted as (
  insert into public.question_sets (syndrome_id, version, status, effective_from)
  select id, 1, 'published', now() from syndrome
  on conflict (syndrome_id, version) do update set status = 'published'
  returning id
)
insert into public.questions
  (question_set_id, code, type, prompt_en, prompt_ha, display_order)
select inserted.id, q.code, q.kind::public.question_type, q.en, q.ha, q.ord
from inserted cross join (values
  ('IS_DEHYDRATED', 'boolean', 'Is the patient very thirsty or dehydrated?', 'Shin majiyyacin yana jin kishirwa sosai ko rashin ruwa a jiki?', 10),
  ('DEHYDRATION_SEVERITY', 'severity_0_10', 'How dehydrated or thirsty is the patient?', 'Yaya tsananin kishirwa ko rashin ruwa a jikin majiyyacin?', 20),
  ('MANY_EPISODES', 'boolean', 'Has the patient had many diarrhoea episodes today?', 'Shin majiyyacin ya yi gudawa sau da yawa a yau?', 30),
  ('DIARRHOEA_SEVERITY', 'severity_0_10', 'How watery is the diarrhoea?', 'Yaya ruwan gudawar yake?', 40)
) as q(code, kind, en, ha, ord)
on conflict (question_set_id, code) do update set
  type = excluded.type, prompt_en = excluded.prompt_en, prompt_ha = excluded.prompt_ha,
  display_order = excluded.display_order, is_active = true;

insert into public.lab_test_definitions (code, version, name_en, result_type)
values
  ('MALARIA_RDT', 1, 'Malaria RDT', 'binary'),
  ('HEPATITIS_B_SURFACE_AG_RDT', 1, 'Hepatitis B Surface Ag RDT', 'binary'),
  ('TYPHOID_SALMONELLA_IGG_IGM_RDT', 1, 'Typhoid/Salmonella IgG/IgM RDT', 'numeric'),
  ('URINALYSIS', 1, 'Urinalysis', 'multi_component'),
  ('RANDOM_BLOOD_SUGAR', 1, 'Random Blood Sugar', 'numeric'),
  ('URINE_PREGNANCY_TEST', 1, 'Urine Pregnancy Test', 'binary'),
  ('HIV_RDT', 1, 'HIV RDT', 'binary'),
  ('HEPATITIS_C_RDT', 1, 'Hepatitis C RDT', 'binary'),
  ('H_PYLORI_STOOL_AG_RDT', 1, 'H. pylori Stool Ag RDT', 'binary')
on conflict (code, version) do update set
  name_en = excluded.name_en, result_type = excluded.result_type, is_active = true;

with urinalysis as (
  select id from public.lab_test_definitions where code = 'URINALYSIS' and version = 1
)
insert into public.lab_test_components
  (lab_test_definition_id, code, label_en, result_type, unit, reference_range, options, display_order)
select urinalysis.id, c.code, c.label, c.kind::public.lab_result_type, c.unit,
  c.range::jsonb, c.options::jsonb, c.ord
from urinalysis cross join (values
  ('COLOUR', 'Colour', 'single_select', null, '{}', '["pale_yellow","yellow","amber","other"]', 10),
  ('CLARITY', 'Clarity', 'single_select', null, '{}', '["clear","slightly_cloudy","cloudy"]', 20),
  ('BLOOD', 'Blood', 'binary', null, '{}', '["negative","positive"]', 30),
  ('UROBILINOGEN', 'Urobilinogen', 'numeric', 'umol/L', '{"min":0.1,"max":1.0}', '[]', 40),
  ('KETONE', 'Ketone', 'binary', null, '{}', '["negative","positive"]', 50),
  ('GLUCOSE', 'Glucose', 'binary', null, '{}', '["negative","positive"]', 60),
  ('PROTEIN', 'Protein', 'binary', null, '{}', '["negative","positive"]', 70)
) as c(code, label, kind, unit, range, options, ord)
on conflict (lab_test_definition_id, code) do update set
  label_en = excluded.label_en, result_type = excluded.result_type,
  unit = excluded.unit, reference_range = excluded.reference_range,
  options = excluded.options, display_order = excluded.display_order;

-- Before production:
-- 1. Clinically review every English/Hausa term and attach approved audio.
-- 2. Add versioned consent text.
-- 3. Add approved triage_rules; do not derive them from mockup sample copy.
-- 4. Add the organization, facilities and staff memberships through an audited admin flow.
-- ECHO / REACH Encounter - LOCAL DEVELOPMENT ONLY seed data.
-- This file is intentionally separate from seed_reference_data.sql.
--
-- It seeds:
--   1. A demo organization and two facilities (source + referral destination)
--      so the app is usable end to end on a fresh local database.
--   2. Versioned consent text (English/Hausa) for anonymous and identified
--      screening -- placeholder copy only, NOT reviewed legal/consent
--      language. Replace before any real use.
--   3. Example triage rules for two syndromes and an example incentive
--      rule, clearly marked as demo content per the PRD ("Examples in the
--      design ... are demo content only. Clinical admins must approve
--      production wording, thresholds and treatment guidance.").
--
-- DO NOT apply this file to a production or staging project. It is only
-- referenced from supabase/config.toml's [db.seed] block, which is only
-- consulted by `supabase db reset` / local development.

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Demo Health Organization', 'demo-health-org')
on conflict (id) do nothing;

insert into public.facilities (id, organization_id, name, code, facility_type, is_active)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Demo Primary Health Centre', 'PHC-DEMO', 'primary_health_centre', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Demo General Hospital', 'GH-DEMO', 'general_hospital', true)
on conflict (id) do nothing;

-- After creating your first user via Supabase Auth (sign up through the app,
-- or `supabase auth admin` / Studio), link it to a facility with:
--
--   insert into public.profiles (id, display_name)
--   values ('<auth-user-uuid>', 'Demo Clinician')
--   on conflict (id) do update set display_name = excluded.display_name;
--
--   insert into public.facility_memberships (user_id, organization_id, facility_id, role)
--   values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001',
--           '00000000-0000-0000-0000-000000000010', 'clinician');
--
-- See README.md for the full local setup walkthrough.

insert into public.consent_text_versions (kind, version, text_en, text_ha, effective_from)
values
  ('anonymous_screening', 1,
   'DEMO CONSENT TEXT (not legally reviewed): I will ask you some questions about your symptoms to help identify possible outbreaks in the community. Your answers will not be linked to your name, phone number or any other identifying information.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Zan yi maka wasu tambayoyi game da alamomin cutar don gano yiwuwar annoba a cikin al''umma. Ba za a hada amsoshinka da suna, lambar waya ko wani abu da za a gane ka da shi ba.',
   now()),
  ('identified_screening', 1,
   'DEMO CONSENT TEXT (not legally reviewed): We would like to collect your name and contact details so we can coordinate your care with the facility you are being referred to. This information will only be shared with that facility.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Muna so mu tattara sunanka da hanyar tuntubarka domin mu tsara kula da lafiyarka tare da wurin da za a mika ka. Za a raba wannan bayanin ne kawai da wurin da aka mika ka.',
   now()),
  ('identified_referral', 1,
   'DEMO CONSENT TEXT (not legally reviewed): By continuing, you agree that your health information may be shared with the destination facility for the purpose of your referral and follow-up care.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Ta hanyar ci gaba, ka yarda cewa za a iya raba bayanan lafiyarka da wurin da aka mika ka domin dalilin mikawa da kula da kai.',
   now())
on conflict (kind, version) do update set
  text_en = excluded.text_en, text_ha = excluded.text_ha, effective_from = excluded.effective_from;

-- Example triage rules (DEMO ONLY -- not clinically reviewed or approved).
with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, ipc_guidance_en, ipc_guidance_ha,
  referral_required, effective_from
)
select syndrome.id, 1, 'published', 10, 'SUSPECTED_CHOLERA_DEMO',
  'Suspected cholera (demo)', 'Ana zargin kwalara (gwaji)',
  'emergency',
  '[{"question_code":"IS_DEHYDRATED","op":"is_true"},{"question_code":"MANY_EPISODES","op":"is_true"}]'::jsonb,
  'DEMO GUIDANCE: Refer immediately for IV rehydration and cholera investigation.',
  'JAGORAR GWAJI: A mika nan take domin ba da ruwa ta jijiya da bincike na kwalara.',
  'DEMO IPC: Isolate the patient, use ORS preparation precautions, notify facility IPC lead.',
  'JAGORAR IPC TA GWAJI: A kebe majiyyaci, a yi hankali wajen shirya ORS, a sanar da shugaban IPC.',
  true, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  ipc_guidance_en = excluded.ipc_guidance_en, ipc_guidance_ha = excluded.ipc_guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, referral_required, effective_from
)
select syndrome.id, 1, 'published', 0, 'MILD_DIARRHOEA_DEMO',
  'Mild acute watery diarrhoea (demo)', 'Gudawa mai ruwa-ruwa mara tsanani (gwaji)',
  'routine',
  '[{"question_code":"MANY_EPISODES","op":"answered"}]'::jsonb,
  'DEMO GUIDANCE: Advise oral rehydration salts and food/water hygiene; review in 48 hours if not improving.',
  'JAGORAR GWAJI: A shawarci amfani da ORS da tsaftar abinci/ruwa; a duba bayan sa''o''i 48 idan bai inganta ba.',
  false, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

with syndrome as (
  select id from public.syndromes where code = 'FEVER_RASH'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, referral_required, effective_from
)
select syndrome.id, 1, 'published', 5, 'FEVER_RASH_URGENT_DEMO',
  'Fever with rash and swollen nodes (demo)', 'Zazzabi da kurji da kumburi (gwaji)',
  'urgent',
  '[{"question_code":"HAS_SWOLLEN_NODES","op":"is_true"},{"question_code":"HAS_RED_EYES","op":"is_true"}]'::jsonb,
  'DEMO GUIDANCE: Urgent clinical review recommended; consider measles/rubella surveillance protocol.',
  'JAGORAR GWAJI: An shawarci bincike na gaggawa; a lura da yiwuwar ciwon kyanda/rubella.',
  true, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

-- Example incentive rule: eligible if closed within 72 hours of creation.
insert into public.incentive_rules (organization_id, version, name, conditions, status, effective_from)
values (
  '00000000-0000-0000-0000-000000000001', 1, 'Closure within 72 hours (demo)',
  '{"max_closure_seconds": 259200}'::jsonb,
  'published', now()
)
on conflict (organization_id, version) do update set
  name = excluded.name, conditions = excluded.conditions, status = 'published';
-- ====================================================================
-- CREATE TEST ACCOUNT(S) IN SUPABASE AUTH + PUBLIC SCHEMA
-- ====================================================================
-- This creates 1@test.com with password 'password', fully confirmed,
-- with an active clinician profile and facility membership at PHC-DEMO.

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_email text := '1@test.com';
  v_password text := 'password';
  v_encrypted_password text;
begin
  -- Generate bcrypt hash for password
  v_encrypted_password := crypt(v_password, gen_salt('bf', 10));

  -- Check if user exists
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Tester 1"}'::jsonb,
      now(),
      now(),
      '',
      '',
      ''
    );

    -- Also insert into auth.identities so Supabase GoTrue recognizes email auth
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    ) on conflict do nothing;

  else
    -- Update existing user password and confirm email
    update auth.users
    set encrypted_password = v_encrypted_password,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- Create public profile
  insert into public.profiles (id, display_name)
  values (v_user_id, 'Tester 1')
  on conflict (id) do update set display_name = excluded.display_name;

  -- Link user to demo facility PHC-DEMO
  insert into public.facility_memberships (user_id, organization_id, facility_id, role, is_active)
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'clinician',
    true
  )
  on conflict (user_id, facility_id) do update set is_active = true;

  raise notice 'Test user % created with ID % and linked to PHC-DEMO', v_email, v_user_id;
end $$;

-- ====================================================================
-- BATCH SCRIPT FOR ALL 90 TESTERS (1@test.com ... 90@test.com)
-- Uncomment the block below when ready to generate all 90 accounts!
-- ====================================================================
/*
do $$
declare
  v_user_id uuid;
  v_email text;
  v_password text := 'password';
  v_encrypted_password text;
  i int;
begin
  v_encrypted_password := crypt(v_password, gen_salt('bf', 10));

  for i in 1..90 loop
    v_email := i || '@test.com';
    select id into v_user_id from auth.users where email = v_email;

    if v_user_id is null then
      v_user_id := gen_random_uuid();
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted_password,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', 'Tester ' || i),
        now(),
        now(),
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        v_user_id,
        v_user_id,
        v_email,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        now(),
        now(),
        now()
      ) on conflict do nothing;

    else
      update auth.users
      set encrypted_password = v_encrypted_password,
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_user_id;
    end if;

    insert into public.profiles (id, display_name)
    values (v_user_id, 'Tester ' || i)
    on conflict (id) do update set display_name = excluded.display_name;

    insert into public.facility_memberships (user_id, organization_id, facility_id, role, is_active)
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000010',
      'clinician',
      true
    )
    on conflict (user_id, facility_id) do update set is_active = true;
  end loop;

  raise notice 'Created 90 test accounts (1@test.com through 90@test.com)';
end $$;
*/
