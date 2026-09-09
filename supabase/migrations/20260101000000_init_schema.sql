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
