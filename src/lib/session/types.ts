import type { AppRole, WorkflowMode } from "@/lib/supabase/database.types";

export interface ActiveFacility {
  facilityId: string;
  organizationId: string;
  facilityName: string;
  facilityCode: string;
  role: AppRole;
}

export interface SessionData {
  userId: string;
  displayName: string;
  staffId: string | null;
  preferredWorkflow: WorkflowMode | null;
  memberships: ActiveFacility[];
}
