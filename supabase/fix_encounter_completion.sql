-- ====================================================================
-- FIX ENCOUNTER COMPLETION & FACILITY CLINICIAN UPDATE POLICIES
-- ====================================================================

-- 1. Expand encounter update policy so any active clinician member of the facility can update/complete encounters in their facility
drop policy if exists encounters_owner_update on public.encounters;
drop policy if exists encounters_member_update on public.encounters;

create policy encounters_member_update on public.encounters for update
using (private.is_facility_member(facility_id))
with check (private.is_facility_member(facility_id));

-- 2. Security definer RPC to complete an encounter cleanly
create or replace function public.complete_encounter(
  p_encounter_id uuid
) returns public.encounters
language plpgsql security definer set search_path = public as $$
declare
  v_enc public.encounters;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  update public.encounters
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_encounter_id
  returning * into v_enc;

  return v_enc;
end;
$$;

grant execute on function public.complete_encounter(uuid) to authenticated;
