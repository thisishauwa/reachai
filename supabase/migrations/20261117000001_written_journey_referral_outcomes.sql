-- Preserve the written Journey 7 and Journey 12 distinction:
--   refused      -> referral remains live so the patient can use the code later
--   not_referred -> recommendation/override are stored without notifying clinic
create or replace function public.save_referral_outcome_v03(
  p_encounter_id uuid,
  p_destination_facility_id uuid,
  p_privacy_mode public.privacy_mode,
  p_consent_id uuid,
  p_referral_code text,
  p_referral_outcome text,
  p_referral_outcome_reason text,
  p_destination_facility_name_free_text text,
  p_idempotency_key uuid
) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  v_encounter public.encounters;
  v_outcome public.triage_outcomes;
  v_existing public.referrals;
  v_referral public.referrals;
  v_status public.referral_status;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Encounter not accessible';
  end if;
  if p_referral_outcome not in ('referred', 'refused', 'not_referred') then
    raise exception 'Invalid referral outcome';
  end if;
  if p_referral_code !~ '^[ABCDEFGHJKLMNPRSTVWXYZ]{2}-[ABCDEFGHJKLMNPRSTVWXYZ]{3}$' then
    raise exception 'Referral code must use the outlet-pair format BK-TRN';
  end if;

  v_status := case when p_referral_outcome = 'not_referred' then 'cancelled' else 'created' end;

  select * into v_encounter from public.encounters where id = p_encounter_id;
  select * into v_outcome from public.triage_outcomes
    where encounter_id = p_encounter_id order by evaluated_at desc limit 1;
  if v_outcome.id is null then raise exception 'Triage outcome required'; end if;

  if p_privacy_mode = 'identified' then
    if p_consent_id is null or v_encounter.patient_id is null then
      raise exception 'Identified referral requires patient and consent';
    end if;
  elsif p_consent_id is not null then
    raise exception 'Anonymous referral must not reference consent';
  end if;

  select * into v_existing from public.referrals where encounter_id = p_encounter_id;
  if found then
    update public.referrals set
      destination_facility_id = p_destination_facility_id,
      destination_facility_name_free_text = p_destination_facility_name_free_text,
      referral_outcome = p_referral_outcome,
      referral_outcome_reason = nullif(trim(p_referral_outcome_reason), ''),
      status = v_status,
      cancelled_at = case when v_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
      cancellation_reason = case when v_status = 'cancelled' then coalesce(nullif(trim(p_referral_outcome_reason), ''), p_referral_outcome) else null end,
      secure_lookup_url = 'https://idsr.ng/r/' || p_referral_code
    where id = v_existing.id
    returning * into v_referral;
    return v_referral;
  end if;

  if exists (select 1 from public.referrals where referral_code = p_referral_code) then
    raise exception 'Referral code already exists';
  end if;

  insert into public.referrals (
    organization_id, encounter_id, triage_outcome_id, source_facility_id,
    destination_facility_id, patient_id, consent_id, privacy_mode,
    referral_code, status, created_by, cancelled_at, cancellation_reason,
    referral_outcome, referral_outcome_reason,
    destination_facility_name_free_text, secure_lookup_url
  ) values (
    v_encounter.organization_id, p_encounter_id, v_outcome.id,
    v_encounter.facility_id, p_destination_facility_id,
    case when p_privacy_mode = 'identified' then v_encounter.patient_id else null end,
    case when p_privacy_mode = 'identified' then p_consent_id else null end,
    p_privacy_mode, p_referral_code, v_status, auth.uid(),
    case when v_status = 'cancelled' then now() else null end,
    case when v_status = 'cancelled' then coalesce(nullif(trim(p_referral_outcome_reason), ''), p_referral_outcome) else null end,
    p_referral_outcome, nullif(trim(p_referral_outcome_reason), ''),
    p_destination_facility_name_free_text,
    'https://idsr.ng/r/' || p_referral_code
  ) returning * into v_referral;

  insert into public.referral_events (
    referral_id, from_status, to_status, actor_id, facility_id,
    reason, idempotency_key
  ) values (
    v_referral.id, null, v_status, auth.uid(), v_encounter.facility_id,
    case when v_status = 'cancelled' then coalesce(nullif(trim(p_referral_outcome_reason), ''), p_referral_outcome) else null end,
    p_idempotency_key
  );

  -- Journey 12 says the code is generated and held. Do not tell the clinic a
  -- referral is coming when the vendor explicitly chose "No".
  if p_referral_outcome in ('referred', 'refused') then
    insert into public.notifications (user_id, type, payload)
    select membership.user_id, 'referral_created',
      jsonb_build_object(
        'referral_id', v_referral.id,
        'referral_code', v_referral.referral_code,
        'referral_outcome', p_referral_outcome
      )
    from public.facility_memberships membership
    where membership.facility_id = p_destination_facility_id and membership.is_active;
  end if;

  return v_referral;
end;
$$;

grant execute on function public.save_referral_outcome_v03(
  uuid, uuid, public.privacy_mode, uuid, text, text, text, text, uuid
) to authenticated;
