// Hand-authored Supabase database types mirroring
// supabase/migrations/20260101000000_init_schema.sql.
//
// Once a real Supabase project exists, regenerate the authoritative version with:
//   supabase gen types typescript --local > src/lib/supabase/database.types.ts
// and reconcile any drift with this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole =
  | "clinician"
  | "referral_clinician"
  | "facility_admin"
  | "clinical_admin"
  | "platform_admin";

export type WorkflowMode = "reach" | "echo";
export type PrivacyMode = "identified" | "anonymous";
export type EncounterStatus = "draft" | "in_progress" | "completed" | "voided";
export type ConsentKind =
  | "anonymous_screening"
  | "identified_screening"
  | "identified_referral";
export type ConsentMethod =
  | "verbal_attestation"
  | "typed_signature"
  | "drawn_signature";
export type QuestionType =
  | "boolean"
  | "severity_0_10"
  | "integer"
  | "decimal"
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select";
export type TriageSeverity = "none" | "routine" | "urgent" | "emergency";
export type LabResultType =
  | "binary"
  | "numeric"
  | "single_select"
  | "multi_component";
export type ReferralStatus = "created" | "arrived" | "closed" | "cancelled";
export type NotificationType =
  | "referral_created"
  | "referral_arrived"
  | "referral_closed"
  | "referral_cancelled"
  | "sync_attention";

interface Table<Row, Insert, Update = Partial<Insert>> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      organizations: Table<
        { id: string; name: string; slug: string; created_at: string },
        { id?: string; name: string; slug: string; created_at?: string }
      >;
      facilities: Table<
        {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          facility_type: string | null;
          timezone: string;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          facility_type?: string | null;
          timezone?: string;
          is_active?: boolean;
        }
      >;
      profiles: Table<
        {
          id: string;
          display_name: string;
          staff_id: string | null;
          preferred_workflow: WorkflowMode | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          display_name: string;
          staff_id?: string | null;
          preferred_workflow?: WorkflowMode | null;
        }
      >;
      facility_memberships: Table<
        {
          id: string;
          user_id: string;
          organization_id: string;
          facility_id: string;
          role: AppRole;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          organization_id: string;
          facility_id: string;
          role?: AppRole;
          is_active?: boolean;
        }
      >;
      patients: Table<
        {
          id: string;
          organization_id: string;
          facility_id: string;
          patient_code: string;
          full_name: string;
          phone_e164: string | null;
          age_band: string;
          sex: "female" | "male" | "intersex" | "unknown";
          pregnancy_status: string | null;
          occupation_type: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        },
        {
          id?: string;
          organization_id: string;
          facility_id: string;
          patient_code: string;
          full_name: string;
          phone_e164?: string | null;
          age_band: string;
          sex: "female" | "male" | "intersex" | "unknown";
          pregnancy_status?: string | null;
          occupation_type: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        }
      >;
      encounters: Table<
        {
          id: string;
          organization_id: string;
          facility_id: string;
          clinician_id: string;
          patient_id: string | null;
          encounter_code: string;
          session_code: string | null;
          workflow_mode: WorkflowMode;
          privacy_mode: PrivacyMode;
          status: EncounterStatus;
          locale: "en" | "ha";
          source_device_id: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          facility_id: string;
          clinician_id: string;
          patient_id?: string | null;
          encounter_code: string;
          session_code?: string | null;
          workflow_mode: WorkflowMode;
          privacy_mode: PrivacyMode;
          status?: EncounterStatus;
          locale?: "en" | "ha";
          source_device_id?: string | null;
          completed_at?: string | null;
        },
        Partial<{
          status: EncounterStatus;
          completed_at: string | null;
          locale: "en" | "ha";
        }>
      >;
      encounter_demographics: Table<
        {
          encounter_id: string;
          age_band: string;
          sex: "female" | "male" | "intersex" | "unknown";
          pregnancy_status: string | null;
          occupation_type: string;
          full_name: string | null;
          phone_e164: string | null;
          patient_code: string | null;
          created_at: string;
        },
        {
          encounter_id: string;
          age_band: string;
          sex: "female" | "male" | "intersex" | "unknown";
          pregnancy_status?: string | null;
          occupation_type: string;
          full_name?: string | null;
          phone_e164?: string | null;
          patient_code?: string | null;
        }
      >;
      consent_text_versions: Table<
        {
          id: string;
          kind: ConsentKind;
          version: number;
          text_en: string;
          text_ha: string;
          effective_from: string;
          retired_at: string | null;
          approved_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          kind: ConsentKind;
          version: number;
          text_en: string;
          text_ha: string;
          effective_from: string;
          retired_at?: string | null;
          approved_by?: string | null;
        }
      >;
      consents: Table<
        {
          id: string;
          encounter_id: string;
          text_version_id: string;
          kind: ConsentKind;
          method: ConsentMethod;
          clinician_attested_by: string | null;
          typed_signer_name: string | null;
          signature_storage_path: string | null;
          consented_at: string;
          revoked_at: string | null;
          revocation_reason: string | null;
        },
        {
          id?: string;
          encounter_id: string;
          text_version_id: string;
          kind: ConsentKind;
          method: ConsentMethod;
          clinician_attested_by?: string | null;
          typed_signer_name?: string | null;
          signature_storage_path?: string | null;
        }
      >;
      syndromes: Table<
        {
          id: string;
          code: string;
          label_en: string;
          label_ha: string;
          audio_storage_path: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          code: string;
          label_en: string;
          label_ha: string;
          audio_storage_path?: string | null;
          display_order?: number;
          is_active?: boolean;
        }
      >;
      question_sets: Table<
        {
          id: string;
          syndrome_id: string;
          version: number;
          status: "draft" | "published" | "retired";
          effective_from: string | null;
          retired_at: string | null;
          created_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          syndrome_id: string;
          version: number;
          status?: "draft" | "published" | "retired";
          effective_from?: string | null;
          retired_at?: string | null;
          created_by?: string | null;
        }
      >;
      questions: Table<
        {
          id: string;
          question_set_id: string;
          code: string;
          type: QuestionType;
          prompt_en: string;
          prompt_ha: string;
          help_en: string | null;
          help_ha: string | null;
          audio_storage_path: string | null;
          is_required: boolean;
          display_order: number;
          validation: Json;
          show_when: Json;
          is_active: boolean;
        },
        {
          id?: string;
          question_set_id: string;
          code: string;
          type: QuestionType;
          prompt_en: string;
          prompt_ha: string;
          help_en?: string | null;
          help_ha?: string | null;
          audio_storage_path?: string | null;
          is_required?: boolean;
          display_order: number;
          validation?: Json;
          show_when?: Json;
          is_active?: boolean;
        }
      >;
      question_options: Table<
        {
          id: string;
          question_id: string;
          value: string;
          label_en: string;
          label_ha: string;
          display_order: number;
        },
        {
          id?: string;
          question_id: string;
          value: string;
          label_en: string;
          label_ha: string;
          display_order?: number;
        }
      >;
      encounter_syndromes: Table<
        {
          encounter_id: string;
          syndrome_id: string;
          question_set_id: string;
          selected_at: string;
        },
        { encounter_id: string; syndrome_id: string; question_set_id: string }
      >;
      encounter_answers: Table<
        {
          id: string;
          encounter_id: string;
          question_id: string;
          value: Json;
          answered_by: string;
          answered_at: string;
          superseded_at: string | null;
          client_updated_at: string;
        },
        {
          id?: string;
          encounter_id: string;
          question_id: string;
          value: Json;
          answered_by: string;
          client_updated_at: string;
          superseded_at?: string | null;
        }
      >;
      clinical_notes: Table<
        {
          encounter_id: string;
          chief_complaint: string | null;
          past_medical_history: string | null;
          physical_examination: string | null;
          updated_by: string;
          updated_at: string;
        },
        {
          encounter_id: string;
          chief_complaint?: string | null;
          past_medical_history?: string | null;
          physical_examination?: string | null;
          updated_by: string;
        }
      >;
      lab_test_definitions: Table<
        {
          id: string;
          code: string;
          version: number;
          name_en: string;
          name_ha: string | null;
          result_type: LabResultType;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          code: string;
          version?: number;
          name_en: string;
          name_ha?: string | null;
          result_type: LabResultType;
          is_active?: boolean;
        }
      >;
      lab_test_components: Table<
        {
          id: string;
          lab_test_definition_id: string;
          code: string;
          label_en: string;
          label_ha: string | null;
          result_type: LabResultType;
          unit: string | null;
          reference_range: Json;
          options: Json;
          is_required: boolean;
          display_order: number;
        },
        {
          id?: string;
          lab_test_definition_id: string;
          code: string;
          label_en: string;
          label_ha?: string | null;
          result_type: LabResultType;
          unit?: string | null;
          reference_range?: Json;
          options?: Json;
          is_required?: boolean;
          display_order?: number;
        }
      >;
      encounter_lab_tests: Table<
        {
          id: string;
          encounter_id: string;
          lab_test_definition_id: string;
          ordered_by: string;
          ordered_at: string;
          status: "ordered" | "resulted" | "cancelled";
        },
        {
          id?: string;
          encounter_id: string;
          lab_test_definition_id: string;
          ordered_by: string;
          status?: "ordered" | "resulted" | "cancelled";
        }
      >;
      encounter_lab_results: Table<
        {
          id: string;
          encounter_lab_test_id: string;
          component_id: string | null;
          value: Json | null;
          unit_snapshot: string | null;
          resulted_by: string | null;
          resulted_at: string | null;
        },
        {
          id?: string;
          encounter_lab_test_id: string;
          component_id?: string | null;
          value?: Json | null;
          unit_snapshot?: string | null;
          resulted_by?: string | null;
          resulted_at?: string | null;
        }
      >;
      encounter_diagnoses: Table<
        {
          id: string;
          encounter_id: string;
          diagnosis_code: string | null;
          diagnosis_label: string;
          is_primary: boolean;
          recorded_by: string;
          recorded_at: string;
        },
        {
          id?: string;
          encounter_id: string;
          diagnosis_code?: string | null;
          diagnosis_label: string;
          is_primary?: boolean;
          recorded_by: string;
        }
      >;
      treatment_plans: Table<
        {
          encounter_id: string;
          plan_text: string;
          recorded_by: string;
          recorded_at: string;
          updated_at: string;
        },
        { encounter_id: string; plan_text: string; recorded_by: string }
      >;
      prescriptions: Table<
        {
          id: string;
          encounter_id: string;
          medication_name: string;
          dose: string | null;
          route: string | null;
          frequency: string | null;
          duration: string | null;
          instructions: string | null;
          prescribed_by: string;
          prescribed_at: string;
        },
        {
          id?: string;
          encounter_id: string;
          medication_name: string;
          dose?: string | null;
          route?: string | null;
          frequency?: string | null;
          duration?: string | null;
          instructions?: string | null;
          prescribed_by: string;
        }
      >;
      triage_rules: Table<
        {
          id: string;
          syndrome_id: string;
          version: number;
          status: "draft" | "published" | "retired";
          priority: number;
          condition_code: string;
          condition_label_en: string;
          condition_label_ha: string | null;
          severity: TriageSeverity;
          conditions: Json;
          guidance_en: string;
          guidance_ha: string | null;
          ipc_guidance_en: string | null;
          ipc_guidance_ha: string | null;
          referral_required: boolean;
          effective_from: string | null;
          retired_at: string | null;
          approved_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          syndrome_id: string;
          version: number;
          status?: "draft" | "published" | "retired";
          priority?: number;
          condition_code: string;
          condition_label_en: string;
          condition_label_ha?: string | null;
          severity: TriageSeverity;
          conditions: Json;
          guidance_en: string;
          guidance_ha?: string | null;
          ipc_guidance_en?: string | null;
          ipc_guidance_ha?: string | null;
          referral_required?: boolean;
          effective_from?: string | null;
          retired_at?: string | null;
          approved_by?: string | null;
        }
      >;
      triage_outcomes: Table<
        {
          id: string;
          encounter_id: string;
          triage_rule_id: string | null;
          severity: TriageSeverity;
          condition_code: string | null;
          condition_label_en: string | null;
          condition_label_ha: string | null;
          guidance_en: string | null;
          guidance_ha: string | null;
          ipc_guidance_en: string | null;
          ipc_guidance_ha: string | null;
          referral_required: boolean;
          evaluated_inputs: Json;
          ruleset_snapshot: Json;
          evaluated_at: string;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          override_reason: string | null;
        },
        {
          id?: string;
          encounter_id: string;
          triage_rule_id?: string | null;
          severity: TriageSeverity;
          condition_code?: string | null;
          condition_label_en?: string | null;
          condition_label_ha?: string | null;
          guidance_en?: string | null;
          guidance_ha?: string | null;
          ipc_guidance_en?: string | null;
          ipc_guidance_ha?: string | null;
          referral_required?: boolean;
          evaluated_inputs: Json;
          ruleset_snapshot: Json;
        },
        Partial<{
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          override_reason: string | null;
        }>
      >;
      referrals: Table<
        {
          id: string;
          organization_id: string;
          encounter_id: string;
          triage_outcome_id: string;
          source_facility_id: string;
          destination_facility_id: string;
          patient_id: string | null;
          consent_id: string | null;
          privacy_mode: PrivacyMode;
          referral_code: string;
          status: ReferralStatus;
          created_by: string;
          created_at: string;
          arrived_at: string | null;
          closed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        },
        never
      >;
      referral_events: Table<
        {
          id: string;
          referral_id: string;
          from_status: ReferralStatus | null;
          to_status: ReferralStatus;
          reason: string | null;
          actor_id: string;
          facility_id: string;
          occurred_at: string;
          idempotency_key: string;
        },
        never
      >;
      incentive_rules: Table<
        {
          id: string;
          organization_id: string;
          version: number;
          name: string;
          conditions: Json;
          status: "draft" | "published" | "retired";
          effective_from: string | null;
          retired_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          version: number;
          name: string;
          conditions: Json;
          status?: "draft" | "published" | "retired";
          effective_from?: string | null;
          retired_at?: string | null;
        }
      >;
      incentive_evaluations: Table<
        {
          id: string;
          referral_id: string;
          incentive_rule_id: string;
          eligible: boolean;
          reason: string | null;
          closure_seconds: number | null;
          evaluated_at: string;
        },
        never
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          type: NotificationType;
          payload: Json;
          created_at: string;
          read_at: string | null;
        },
        never,
        Partial<{ read_at: string | null }>
      >;
      client_mutations: Table<
        {
          idempotency_key: string;
          user_id: string;
          device_id: string;
          entity_type: string;
          entity_id: string | null;
          operation: string;
          request_hash: string;
          response: Json | null;
          processed_at: string;
        },
        never
      >;
      audit_logs: Table<
        {
          id: number;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          facility_id: string | null;
          purpose: string | null;
          metadata: Json;
          occurred_at: string;
        },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      evaluate_triage: {
        Args: { p_encounter_id: string; p_idempotency_key: string };
        Returns: Database["public"]["Tables"]["triage_outcomes"]["Row"];
      };
      create_referral: {
        Args: {
          p_encounter_id: string;
          p_destination_facility_id: string;
          p_privacy_mode: PrivacyMode;
          p_consent_id: string | null;
          p_idempotency_key: string;
        };
        Returns: Database["public"]["Tables"]["referrals"]["Row"];
      };
      transition_referral: {
        Args: {
          p_referral_id: string;
          p_to_status: ReferralStatus;
          p_reason: string | null;
          p_idempotency_key: string;
        };
        Returns: Database["public"]["Tables"]["referrals"]["Row"];
      };
      acknowledge_triage: {
        Args: {
          p_triage_outcome_id: string;
          p_override_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["triage_outcomes"]["Row"];
      };
    };
    Enums: {
      app_role: AppRole;
      workflow_mode: WorkflowMode;
      privacy_mode: PrivacyMode;
      encounter_status: EncounterStatus;
      consent_kind: ConsentKind;
      consent_method: ConsentMethod;
      question_type: QuestionType;
      triage_severity: TriageSeverity;
      lab_result_type: LabResultType;
      referral_status: ReferralStatus;
      notification_type: NotificationType;
    };
  };
}

export type TriageOutcomeRow = Database["public"]["Tables"]["triage_outcomes"]["Row"];
