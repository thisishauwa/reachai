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
