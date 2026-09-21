-- 1. Allow updating triage_outcomes so clinicians can acknowledge emergency guidance
drop policy if exists triage_outcomes_update on public.triage_outcomes;
create policy triage_outcomes_update on public.triage_outcomes for update
using (private.can_access_encounter(encounter_id))
with check (private.can_access_encounter(encounter_id));

-- 2. Allow updating consents for upsert operations
drop policy if exists consents_encounter_update on public.consents;
create policy consents_encounter_update on public.consents for update
using (private.can_access_encounter(encounter_id))
with check (private.can_access_encounter(encounter_id));

-- 3. Security-definer RPC to acknowledge triage outcome reliably
create or replace function public.acknowledge_triage(
  p_triage_outcome_id uuid,
  p_override_reason text default null
) returns public.triage_outcomes
language plpgsql security definer set search_path = public as $$
declare
  v_outcome public.triage_outcomes;
begin
  select * into v_outcome from public.triage_outcomes where id = p_triage_outcome_id;
  if not found then
    raise exception 'Triage outcome not found';
  end if;
  if not private.can_access_encounter(v_outcome.encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  update public.triage_outcomes
  set acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      override_reason = p_override_reason
  where id = p_triage_outcome_id
  returning * into v_outcome;

  return v_outcome;
end;
$$;

grant execute on function public.acknowledge_triage(uuid, text) to authenticated;
