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
