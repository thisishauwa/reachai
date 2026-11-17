-- IDSR-light v0.3 referral outcome and five-letter code support.
alter table public.facilities
  add column if not exists phone_e164 text,
  add column if not exists address_text text,
  add column if not exists distance_label text,
  add column if not exists opening_status text;

alter table public.referrals
  add column if not exists referral_outcome text
    check (referral_outcome in ('referred', 'refused', 'not_referred')),
  add column if not exists referral_outcome_reason text,
  add column if not exists destination_facility_name_free_text text,
  add column if not exists secure_lookup_url text;

create or replace function public.create_referral_v03(
  p_encounter_id uuid,
  p_destination_facility_id uuid,
  p_privacy_mode public.privacy_mode,
  p_consent_id uuid,
  p_referral_code text,
  p_idempotency_key uuid
) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  v_encounter public.encounters;
  v_outcome public.triage_outcomes;
  v_existing public.referrals;
  v_referral public.referrals;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Encounter not accessible';
  end if;

  select * into v_existing from public.referrals where encounter_id = p_encounter_id;
  if found then return v_existing; end if;

  if p_referral_code !~ '^[ABCDEFGHJKLMNPRSTVWXYZ]{2}-[ABCDEFGHJKLMNPRSTVWXYZ]{3}$' then
    raise exception 'Referral code must use the outlet-pair format BK-TRN';
  end if;
  if exists (select 1 from public.referrals where referral_code = p_referral_code) then
    raise exception 'Referral code already exists';
  end if;

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

  insert into public.referrals (
    organization_id, encounter_id, triage_outcome_id, source_facility_id,
    destination_facility_id, patient_id, consent_id, privacy_mode,
    referral_code, created_by, secure_lookup_url
  ) values (
    v_encounter.organization_id, p_encounter_id, v_outcome.id,
    v_encounter.facility_id, p_destination_facility_id,
    case when p_privacy_mode = 'identified' then v_encounter.patient_id else null end,
    case when p_privacy_mode = 'identified' then p_consent_id else null end,
    p_privacy_mode, p_referral_code, auth.uid(),
    'https://idsr.ng/r/' || p_referral_code
  ) returning * into v_referral;

  insert into public.referral_events (
    referral_id, from_status, to_status, actor_id, facility_id, idempotency_key
  ) values (
    v_referral.id, null, 'created', auth.uid(), v_encounter.facility_id,
    p_idempotency_key
  );

  insert into public.notifications (user_id, type, payload)
  select membership.user_id, 'referral_created',
    jsonb_build_object('referral_id', v_referral.id, 'referral_code', v_referral.referral_code)
  from public.facility_memberships membership
  where membership.facility_id = p_destination_facility_id and membership.is_active;

  return v_referral;
end;
$$;

grant execute on function public.create_referral_v03(uuid, uuid, public.privacy_mode, uuid, text, uuid) to authenticated;
