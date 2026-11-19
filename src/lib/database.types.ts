
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
                    "chair_id": string,"clinic_id": string,"created_at": string,"created_by": string | null,"desk_note": string | null,"doctor_member_id": string,"ends_at": string,"id": string,"patient_id": string | null,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"status_changed_at": string | null,"status_changed_by": string | null,"visit_type": Database["public"]['Enums']["visit_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "chair_id": string,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"desk_note"?: string | null,"doctor_member_id": string,"ends_at": string,"id"?: string,"patient_id"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"status_changed_at"?: string | null,"status_changed_by"?: string | null,"visit_type": Database["public"]['Enums']["visit_type"]
                  }
                  Update: {
                    "chair_id"?: string,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"desk_note"?: string | null,"doctor_member_id"?: string,"ends_at"?: string,"id"?: string,"patient_id"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"status_changed_at"?: string | null,"status_changed_by"?: string | null,"visit_type"?: Database["public"]['Enums']["visit_type"]
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
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "appointments_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "check_in": string,"check_out": string | null,"clinic_id": string,"created_at": string,"id": string,"in_source": string,"member_id": string,"out_source": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "check_in": string,"check_out"?: string | null,"clinic_id": string,"created_at"?: string,"id"?: string,"in_source": string,"member_id": string,"out_source"?: string | null
                  }
                  Update: {
                    "check_in"?: string,"check_out"?: string | null,"clinic_id"?: string,"created_at"?: string,"id"?: string,"in_source"?: string,"member_id"?: string,"out_source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_clinic_id_member_id_fkey"
      columns: ["clinic_id","member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"attendance_changes": {
                  Row: {
                    "attendance_id": string,"changed_at": string,"changed_by": string | null,"clinic_id": string,"id": number,"new_in": string,"new_out": string | null,"old_in": string | null,"old_out": string | null,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"changed_at"?: string,"changed_by"?: string | null,"clinic_id": string,"id"?: never,"new_in": string,"new_out"?: string | null,"old_in"?: string | null,"old_out"?: string | null,"reason": string
                  }
                  Update: {
                    "attendance_id"?: string,"changed_at"?: string,"changed_by"?: string | null,"clinic_id"?: string,"id"?: never,"new_in"?: string,"new_out"?: string | null,"old_in"?: string | null,"old_out"?: string | null,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_changes_clinic_id_attendance_id_fkey"
      columns: ["clinic_id","attendance_id"]
isOneToOne: false
      referencedRelation: "attendance"
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
                },"charge_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"charge_id": string,"clinic_id": string,"id": number,"new_amount": number,"note": string,"old_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"charge_id": string,"clinic_id": string,"id"?: never,"new_amount": number,"note": string,"old_amount": number
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"charge_id"?: string,"clinic_id"?: string,"id"?: never,"new_amount"?: number,"note"?: string,"old_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "charge_changes_clinic_id_charge_id_fkey"
      columns: ["clinic_id","charge_id"]
isOneToOne: false
      referencedRelation: "patient_charges"
      referencedColumns: ["clinic_id","id"]
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
                },"doctor_commissions": {
                  Row: {
                    "clinic_id": string,"member_id": string,"rate": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"member_id": string,"rate"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"member_id"?: string,"rate"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "doctor_commissions_clinic_id_member_id_fkey"
      columns: ["clinic_id","member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"kiosk_devices": {
                  Row: {
                    "clinic_id": string,"created_at": string,"last_seen_at": string | null,"member_id": string,"name": string,"paired_by": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"last_seen_at"?: string | null,"member_id": string,"name": string,"paired_by"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"last_seen_at"?: string | null,"member_id"?: string,"name"?: string,"paired_by"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "kiosk_devices_clinic_id_member_id_fkey"
      columns: ["clinic_id","member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    }
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
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
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
                },"note_phrases": {
                  Row: {
                    "clinic_id": string,"created_at": string,"id": string,"member_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"id"?: string,"member_id": string,"text": string
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"id"?: string,"member_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_phrases_clinic_id_member_id_fkey"
      columns: ["clinic_id","member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"note_revisions": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"clinic_id": string,"id": number,"note_id": string,"old_body": string,"old_teeth": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"clinic_id": string,"id"?: never,"note_id": string,"old_body": string,"old_teeth": (number)[]
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"clinic_id"?: string,"id"?: never,"note_id"?: string,"old_body"?: string,"old_teeth"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_revisions_clinic_id_note_id_fkey"
      columns: ["clinic_id","note_id"]
isOneToOne: false
      referencedRelation: "patient_notes"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"patient_charges": {
                  Row: {
                    "adjust_note": string | null,"amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"change_note": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"description": string,"id": string,"list_amount": number | null,"patient_id": string,"price_item_id": string | null,"tooth": string | null,"treatment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjust_note"?: string | null,"amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"change_note"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"list_amount"?: number | null,"patient_id": string,"price_item_id"?: string | null,"tooth"?: string | null,"treatment_id"?: string | null
                  }
                  Update: {
                    "adjust_note"?: string | null,"amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"change_note"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"list_amount"?: number | null,"patient_id"?: string,"price_item_id"?: string | null,"tooth"?: string | null,"treatment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_charges_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "patient_charges_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_charges_clinic_id_price_item_id_fkey"
      columns: ["clinic_id","price_item_id"]
isOneToOne: false
      referencedRelation: "price_list_items"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_charges_clinic_id_treatment_id_fkey"
      columns: ["clinic_id","treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
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
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "patient_medical_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"patient_notes": {
                  Row: {
                    "appointment_id": string | null,"author_member_id": string,"body": string,"clinic_id": string,"created_at": string,"data": Json | null,"edit_count": number,"edited_at": string | null,"hidden": boolean,"id": string,"important": boolean,"kind": Database["public"]['Enums']["note_kind"],"parent_id": string | null,"patient_id": string,"teeth": (number)[],"template": string | null,"treatment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"author_member_id": string,"body": string,"clinic_id": string,"created_at"?: string,"data"?: Json | null,"edit_count"?: number,"edited_at"?: string | null,"hidden"?: boolean,"id"?: string,"important"?: boolean,"kind": Database["public"]['Enums']["note_kind"],"parent_id"?: string | null,"patient_id": string,"teeth"?: (number)[],"template"?: string | null,"treatment_id"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"author_member_id"?: string,"body"?: string,"clinic_id"?: string,"created_at"?: string,"data"?: Json | null,"edit_count"?: number,"edited_at"?: string | null,"hidden"?: boolean,"id"?: string,"important"?: boolean,"kind"?: Database["public"]['Enums']["note_kind"],"parent_id"?: string | null,"patient_id"?: string,"teeth"?: (number)[],"template"?: string | null,"treatment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_notes_clinic_id_appointment_id_fkey"
      columns: ["clinic_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_notes_clinic_id_author_member_id_fkey"
      columns: ["clinic_id","author_member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_notes_clinic_id_parent_id_fkey"
      columns: ["clinic_id","parent_id"]
isOneToOne: false
      referencedRelation: "patient_notes"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_notes_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "patient_notes_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "patient_notes_clinic_id_treatment_id_fkey"
      columns: ["clinic_id","treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"patient_payments": {
                  Row: {
                    "amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"clinic_id": string,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"note": string | null,"paid_on": string,"patient_id": string,"received_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id": string,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_on"?: string,"patient_id": string,"received_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id"?: string,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_on"?: string,"patient_id"?: string,"received_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_payments_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "patient_payments_clinic_id_patient_id_fkey"
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
                },"price_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"clinic_id": string,"id": number,"item_id": string,"new_amount": number,"note": string | null,"old_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"clinic_id": string,"id"?: never,"item_id": string,"new_amount": number,"note"?: string | null,"old_amount": number
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"clinic_id"?: string,"id"?: never,"item_id"?: string,"new_amount"?: number,"note"?: string | null,"old_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_changes_clinic_id_item_id_fkey"
      columns: ["clinic_id","item_id"]
isOneToOne: false
      referencedRelation: "price_list_items"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"price_list_items": {
                  Row: {
                    "active": boolean,"amount": number,"change_note": string | null,"clinic_id": string,"created_at": string,"id": string,"name": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount": number,"change_note"?: string | null,"clinic_id": string,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"amount"?: number,"change_note"?: string | null,"clinic_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_list_items_clinic_id_fkey"
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
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
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
                },"stock_costs": {
                  Row: {
                    "clinic_id": string,"movement_id": string,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"movement_id": string,"unit_cost": number
                  }
                  Update: {
                    "clinic_id"?: string,"movement_id"?: string,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_costs_clinic_id_movement_id_fkey"
      columns: ["clinic_id","movement_id"]
isOneToOne: false
      referencedRelation: "stock_movements"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"stock_items": {
                  Row: {
                    "active": boolean,"barcode": string | null,"category": Database["public"]['Enums']["stock_category"],"clinic_id": string,"created_at": string,"id": string,"min_level": number,"name": string,"pack_name": string | null,"pack_size": number,"supplier": string | null,"track_lots": boolean,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barcode"?: string | null,"category"?: Database["public"]['Enums']["stock_category"],"clinic_id": string,"created_at"?: string,"id"?: string,"min_level"?: number,"name": string,"pack_name"?: string | null,"pack_size"?: number,"supplier"?: string | null,"track_lots"?: boolean,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"barcode"?: string | null,"category"?: Database["public"]['Enums']["stock_category"],"clinic_id"?: string,"created_at"?: string,"id"?: string,"min_level"?: number,"name"?: string,"pack_name"?: string | null,"pack_size"?: number,"supplier"?: string | null,"track_lots"?: boolean,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_items_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "appointment_id": string | null,"clinic_id": string,"counted_quantity": number | null,"created_at": string,"created_by": string | null,"expiry_date": string | null,"id": string,"item_id": string,"kind": Database["public"]['Enums']["stock_movement_kind"],"lot_no": string | null,"note": string | null,"patient_id": string | null,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"clinic_id": string,"counted_quantity"?: number | null,"created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_id": string,"kind": Database["public"]['Enums']["stock_movement_kind"],"lot_no"?: string | null,"note"?: string | null,"patient_id"?: string | null,"quantity": number
                  }
                  Update: {
                    "appointment_id"?: string | null,"clinic_id"?: string,"counted_quantity"?: number | null,"created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["stock_movement_kind"],"lot_no"?: string | null,"note"?: string | null,"patient_id"?: string | null,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_clinic_id_appointment_id_fkey"
      columns: ["clinic_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "stock_movements_clinic_id_item_id_fkey"
      columns: ["clinic_id","item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "stock_movements_clinic_id_item_id_fkey"
      columns: ["clinic_id","item_id"]
isOneToOne: false
      referencedRelation: "stock_levels"
      referencedColumns: ["clinic_id","item_id"]
    },{
      foreignKeyName: "stock_movements_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "stock_movements_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_member_id": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"done_at": string | null,"done_by": string | null,"due_date": string | null,"id": string,"priority": Database["public"]['Enums']["task_priority"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_member_id"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"title": string
                  }
                  Update: {
                    "assignee_member_id"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"title"?: string
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
                    "clinic_id": string,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"doctor_member_id": string,"id": string,"note": string | null,"patient_id": string,"performed_on": string,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"doctor_member_id": string,"id"?: string,"note"?: string | null,"patient_id": string,"performed_on": string,"procedure": string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"doctor_member_id"?: string,"id"?: string,"note"?: string | null,"patient_id"?: string,"performed_on"?: string,"procedure"?: string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
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
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
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
            "activity_feed": {
                  Row: {
                    "actor_user_id": string | null,"amount": number | null,"category": string | null,"clinic_id": string | null,"detail": string | null,"event": string | null,"id": string | null,"occurred_at": string | null,"patient_id": string | null,"patient_name": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"patient_balances": {
                  Row: {
                    "clinic_id": string,"patient_id": string,"total_charged": number | null,"total_paid": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "clinic_id"?: string | null,"patient_id"?: string | null,"total_charged"?: never,"total_paid"?: never
                         }
                        Update: {
                           "clinic_id"?: string | null,"patient_id"?: string | null,"total_charged"?: never,"total_paid"?: never
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
                },"stock_levels": {
                  Row: {
                    "clinic_id": string,"item_id": string,"quantity": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "clinic_id"?: string | null,"item_id"?: string | null,"quantity"?: never
                         }
                        Update: {
                           "clinic_id"?: string | null,"item_id"?: string | null,"quantity"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "stock_items_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_lots": {
                  Row: {
                    "clinic_id": string,"expiry_date": string | null,"item_id": string,"lot_no": string | null,"quantity": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_clinic_id_item_id_fkey"
      columns: ["clinic_id","item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "stock_movements_clinic_id_item_id_fkey"
      columns: ["clinic_id","item_id"]
isOneToOne: false
      referencedRelation: "stock_levels"
      referencedColumns: ["clinic_id","item_id"]
    }
                  ]
                }
          }
          Functions: {
            "add_attendance":
{ Args: { "p_in": string,"p_member": string,"p_out": string,"p_reason": string }; Returns: string
                           },
"check_in":
{ Args: { "p_code": string }; Returns: {
              "action": string,"at": string,"worked_minutes": number
            }[]
                           },
"claim_device_pairing":
{ Args: { "p_code": string,"p_user": string }; Returns: string
                           },
"close_visit":
{ Args: { "p": Json,"p_appointment": string }; Returns: string
                           },
"correct_attendance":
{ Args: { "p_id": string,"p_in": string,"p_out": string,"p_reason": string }; Returns: undefined
                           },
"create_device_pairing":
{ Args: { "p_clinic": string,"p_name": string }; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"device_pairing_valid":
{ Args: { "p_code": string }; Returns: boolean
                           },
"kiosk_current_code":
{ Args: Record<PropertyKey, never>; Returns: {
              "clinic_name": string,"code": string,"expires_at": string,"qr": string
            }[]
                           },
"report_commission_items":
{ Args: { "p_basis": string,"p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"doctor_member_id": string,"doctor_name": string,"item_date": string,"label": string,"paid_amount": number,"patient_id": string,"patient_name": string,"prim": number,"prim_pending": number,"rate": number,"tooth": string
            }[]
                           },
"report_completed_treatments":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"completed_at": string,"doctor_member_id": string,"doctor_name": string,"done_on": string,"patient_id": string,"patient_name": string,"procedure": string,"tooth": string,"treatment_id": string
            }[]
                           },
"report_payments":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"patient_id": string,"patient_name": string,"received_by_name": string
            }[]
                           },
"revoke_device":
{ Args: { "p_member": string }; Returns: undefined
                           },
"set_commission_rate":
{ Args: { "p_member": string,"p_rate": number }; Returns: undefined
                           },
"treatment_summaries":
{ Args: { "p_patient": string }; Returns: {
              "doctor_name": string,"id": string,"performed_on": string,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string
            }[]
                           }
          }
          Enums: {
            "appointment_status": "bekliyor"|"onaylandi"|"tamamlandi"|"gelmedi"|"iptal","clinic_role": "sahip"|"yonetici"|"hekim"|"resepsiyonist"|"asistan"|"ekran","gender": "kadin"|"erkek"|"belirtilmedi","media_review_status": "inceleme_bekliyor"|"onaylandi"|"tekrar_istendi","member_status": "aktif"|"pasif","note_kind": "klinik"|"randevu"|"odeme","payment_method": "nakit"|"kredi_karti"|"havale"|"diger","radiograph_kind": "panoramik"|"periapikal"|"bitewing"|"sefalometrik"|"diger"|"agiz_ici_fotograf","radiograph_purpose": "tedavi_oncesi"|"tedavi_sonrasi"|"kontrol"|"teshis","stock_category": "sarf"|"anestezik"|"dolgu"|"implant"|"frez_alet"|"sterilizasyon"|"ortodonti"|"diger","stock_movement_kind": "giris"|"kullanim"|"sayim"|"fire","task_priority": "yuksek"|"normal","treatment_status": "planlandi"|"devam"|"tamamlandi","visit_type": "muayene"|"tedavi"|"kontrol"|"cerrahi"|"diger"
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
            "appointment_status": ["bekliyor", "onaylandi", "tamamlandi", "gelmedi", "iptal"],"clinic_role": ["sahip", "yonetici", "hekim", "resepsiyonist", "asistan", "ekran"],"gender": ["kadin", "erkek", "belirtilmedi"],"media_review_status": ["inceleme_bekliyor", "onaylandi", "tekrar_istendi"],"member_status": ["aktif", "pasif"],"note_kind": ["klinik", "randevu", "odeme"],"payment_method": ["nakit", "kredi_karti", "havale", "diger"],"radiograph_kind": ["panoramik", "periapikal", "bitewing", "sefalometrik", "diger", "agiz_ici_fotograf"],"radiograph_purpose": ["tedavi_oncesi", "tedavi_sonrasi", "kontrol", "teshis"],"stock_category": ["sarf", "anestezik", "dolgu", "implant", "frez_alet", "sterilizasyon", "ortodonti", "diger"],"stock_movement_kind": ["giris", "kullanim", "sayim", "fire"],"task_priority": ["yuksek", "normal"],"treatment_status": ["planlandi", "devam", "tamamlandi"],"visit_type": ["muayene", "tedavi", "kontrol", "cerrahi", "diger"]
          }
        }
} as const
