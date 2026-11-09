
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "appointment_clinical": {
                  Row: {
                    "appointment_id": string,"clinic_id": string,"clinical_note": string | null,"procedure": string | null,"tooth": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"clinic_id": string,"clinical_note"?: string | null,"procedure"?: string | null,"tooth"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"clinic_id"?: string,"clinical_note"?: string | null,"procedure"?: string | null,"tooth"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_clinical_clinic_id_appointment_id_fkey"
      columns: ["clinic_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "chair_id": string,"clinic_id": string,"created_at": string,"created_by": string | null,"desk_note": string | null,"doctor_member_id": string,"ends_at": string,"id": string,"patient_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"visit_type": Database["public"]['Enums']["visit_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "chair_id": string,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"desk_note"?: string | null,"doctor_member_id": string,"ends_at": string,"id"?: string,"patient_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"visit_type": Database["public"]['Enums']["visit_type"]
                  }
                  Update: {
                    "chair_id"?: string,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"desk_note"?: string | null,"doctor_member_id"?: string,"ends_at"?: string,"id"?: string,"patient_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"visit_type"?: Database["public"]['Enums']["visit_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_clinic_id_chair_id_fkey"
      columns: ["clinic_id","chair_id"]
isOneToOne: false
      referencedRelation: "chairs"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "appointments_clinic_id_doctor_member_id_fkey"
      columns: ["clinic_id","doctor_member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "appointments_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"at": string,"changed_fields": (string)[],"clinic_id": string | null,"id": number,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"at"?: string,"changed_fields"?: (string)[],"clinic_id"?: string | null,"id"?: never,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"at"?: string,"changed_fields"?: (string)[],"clinic_id"?: string | null,"id"?: never,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"chairs": {
                  Row: {
                    "active": boolean,"clinic_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"clinic_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"clinic_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chairs_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"clinic_members": {
                  Row: {
                    "clinic_id": string,"created_at": string,"display_name": string,"id": string,"status": Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"display_name": string,"id"?: string,"status"?: Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinic_members_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"clinics": {
                  Row: {
                    "close_time": string,"created_at": string,"id": string,"name": string,"open_time": string,"slot_minutes": number,"timezone": string,"working_days": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "close_time"?: string,"created_at"?: string,"id"?: string,"name": string,"open_time"?: string,"slot_minutes"?: number,"timezone"?: string,"working_days"?: (number)[]
                  }
                  Update: {
                    "close_time"?: string,"created_at"?: string,"id"?: string,"name"?: string,"open_time"?: string,"slot_minutes"?: number,"timezone"?: string,"working_days"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"media_requests": {
                  Row: {
                    "clinic_id": string,"fulfilled_at": string | null,"fulfilled_radiograph_id": string | null,"id": string,"kind": Database["public"]['Enums']["radiograph_kind"],"patient_id": string,"purpose": Database["public"]['Enums']["radiograph_purpose"],"reason": string,"requested_at": string,"requested_by": string | null,"source_radiograph_id": string | null,"tooth": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"fulfilled_at"?: string | null,"fulfilled_radiograph_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["radiograph_kind"],"patient_id": string,"purpose": Database["public"]['Enums']["radiograph_purpose"],"reason": string,"requested_at"?: string,"requested_by"?: string | null,"source_radiograph_id"?: string | null,"tooth"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"fulfilled_at"?: string | null,"fulfilled_radiograph_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["radiograph_kind"],"patient_id"?: string,"purpose"?: Database["public"]['Enums']["radiograph_purpose"],"reason"?: string,"requested_at"?: string,"requested_by"?: string | null,"source_radiograph_id"?: string | null,"tooth"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_requests_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "media_requests_fulfilled_radiograph_id_fkey"
      columns: ["fulfilled_radiograph_id"]
isOneToOne: false
      referencedRelation: "radiographs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_requests_source_radiograph_id_fkey"
      columns: ["source_radiograph_id"]
isOneToOne: false
      referencedRelation: "radiographs"
      referencedColumns: ["id"]
    }
                  ]
                },"member_roles": {
                  Row: {
                    "clinic_id": string,"granted_at": string,"granted_by": string | null,"member_id": string,"role": Database["public"]['Enums']["clinic_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"granted_at"?: string,"granted_by"?: string | null,"member_id": string,"role": Database["public"]['Enums']["clinic_role"]
                  }
                  Update: {
                    "clinic_id"?: string,"granted_at"?: string,"granted_by"?: string | null,"member_id"?: string,"role"?: Database["public"]['Enums']["clinic_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_roles_clinic_id_member_id_fkey"
      columns: ["clinic_id","member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"patient_medical": {
                  Row: {
                    "allergies": (string)[],"clinic_id": string,"clinical_notes": string | null,"conditions": (string)[],"patient_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergies"?: (string)[],"clinic_id": string,"clinical_notes"?: string | null,"conditions"?: (string)[],"patient_id": string,"updated_at"?: string
                  }
                  Update: {
                    "allergies"?: (string)[],"clinic_id"?: string,"clinical_notes"?: string | null,"conditions"?: (string)[],"patient_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_medical_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"patients": {
                  Row: {
                    "admin_note": string | null,"archived_at": string | null,"birth_date": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"email": string | null,"first_name": string,"gender": Database["public"]['Enums']["gender"],"has_allergy_alert": boolean,"id": string,"last_name": string,"phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"archived_at"?: string | null,"birth_date"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"first_name": string,"gender"?: Database["public"]['Enums']["gender"],"has_allergy_alert"?: boolean,"id"?: string,"last_name": string,"phone": string
                  }
                  Update: {
                    "admin_note"?: string | null,"archived_at"?: string | null,"birth_date"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"first_name"?: string,"gender"?: Database["public"]['Enums']["gender"],"has_allergy_alert"?: boolean,"id"?: string,"last_name"?: string,"phone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"radiographs": {
                  Row: {
                    "clinic_id": string,"content_type": string,"created_at": string,"id": string,"invalidated_at": string | null,"kind": Database["public"]['Enums']["radiograph_kind"],"note": string | null,"patient_id": string,"purpose": Database["public"]['Enums']["radiograph_purpose"],"request_id": string | null,"review_note": string | null,"review_status": Database["public"]['Enums']["media_review_status"],"reviewed_at": string | null,"reviewed_by": string | null,"storage_path": string,"taken_on": string,"tooth": string | null,"treatment_id": string | null,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"content_type": string,"created_at"?: string,"id"?: string,"invalidated_at"?: string | null,"kind"?: Database["public"]['Enums']["radiograph_kind"],"note"?: string | null,"patient_id": string,"purpose": Database["public"]['Enums']["radiograph_purpose"],"request_id"?: string | null,"review_note"?: string | null,"review_status"?: Database["public"]['Enums']["media_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"storage_path": string,"taken_on"?: string,"tooth"?: string | null,"treatment_id"?: string | null,"uploaded_by"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"content_type"?: string,"created_at"?: string,"id"?: string,"invalidated_at"?: string | null,"kind"?: Database["public"]['Enums']["radiograph_kind"],"note"?: string | null,"patient_id"?: string,"purpose"?: Database["public"]['Enums']["radiograph_purpose"],"request_id"?: string | null,"review_note"?: string | null,"review_status"?: Database["public"]['Enums']["media_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"storage_path"?: string,"taken_on"?: string,"tooth"?: string | null,"treatment_id"?: string | null,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "radiographs_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "radiographs_clinic_id_treatment_id_fkey"
      columns: ["clinic_id","treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "radiographs_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "media_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": Database["public"]['Enums']["clinic_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role": Database["public"]['Enums']["clinic_role"]
                  }
                  Update: {
                    "permission"?: string,"role"?: Database["public"]['Enums']["clinic_role"]
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "assignee_member_id": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"done_at": string | null,"due_date": string | null,"id": string,"priority": Database["public"]['Enums']["task_priority"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_member_id"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"title": string
                  }
                  Update: {
                    "assignee_member_id"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_clinic_id_assignee_member_id_fkey"
      columns: ["clinic_id","assignee_member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "tasks_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"treatments": {
                  Row: {
                    "clinic_id": string,"created_at": string,"doctor_member_id": string,"id": string,"note": string | null,"patient_id": string,"performed_on": string,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"doctor_member_id": string,"id"?: string,"note"?: string | null,"patient_id": string,"performed_on": string,"procedure": string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"doctor_member_id"?: string,"id"?: string,"note"?: string | null,"patient_id"?: string,"performed_on"?: string,"procedure"?: string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatments_clinic_id_doctor_member_id_fkey"
      columns: ["clinic_id","doctor_member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatments_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "appointment_status": "bekliyor"|"onaylandi"|"tamamlandi"|"gelmedi"|"iptal","clinic_role": "sahip"|"yonetici"|"hekim"|"resepsiyonist"|"asistan","gender": "kadin"|"erkek"|"belirtilmedi","media_review_status": "inceleme_bekliyor"|"onaylandi"|"tekrar_istendi","member_status": "aktif"|"pasif","radiograph_kind": "panoramik"|"periapikal"|"bitewing"|"sefalometrik"|"diger"|"agiz_ici_fotograf","radiograph_purpose": "tedavi_oncesi"|"tedavi_sonrasi"|"kontrol"|"teshis","task_priority": "yuksek"|"normal","treatment_status": "planlandi"|"devam"|"tamamlandi","visit_type": "muayene"|"tedavi"|"kontrol"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "appointment_status": ["bekliyor", "onaylandi", "tamamlandi", "gelmedi", "iptal"],"clinic_role": ["sahip", "yonetici", "hekim", "resepsiyonist", "asistan"],"gender": ["kadin", "erkek", "belirtilmedi"],"media_review_status": ["inceleme_bekliyor", "onaylandi", "tekrar_istendi"],"member_status": ["aktif", "pasif"],"radiograph_kind": ["panoramik", "periapikal", "bitewing", "sefalometrik", "diger", "agiz_ici_fotograf"],"radiograph_purpose": ["tedavi_oncesi", "tedavi_sonrasi", "kontrol", "teshis"],"task_priority": ["yuksek", "normal"],"treatment_status": ["planlandi", "devam", "tamamlandi"],"visit_type": ["muayene", "tedavi", "kontrol"]
          }
        }
} as const
