
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
                    "address": string | null,"close_time": string,"created_at": string,"discount_limit_pct": number,"email": string | null,"id": string,"name": string,"open_time": string,"phone": string | null,"slot_minutes": number,"timezone": string,"working_days": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"close_time"?: string,"created_at"?: string,"discount_limit_pct"?: number,"email"?: string | null,"id"?: string,"name": string,"open_time"?: string,"phone"?: string | null,"slot_minutes"?: number,"timezone"?: string,"working_days"?: (number)[]
                  }
                  Update: {
                    "address"?: string | null,"close_time"?: string,"created_at"?: string,"discount_limit_pct"?: number,"email"?: string | null,"id"?: string,"name"?: string,"open_time"?: string,"phone"?: string | null,"slot_minutes"?: number,"timezone"?: string,"working_days"?: (number)[]
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
                },"lab_statements": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"created_by_name": string | null,"currency": string,"id": string,"invoice_date": string,"invoice_no": string | null,"lab_id": string,"note": string | null,"period_end": string,"period_start": string,"rate": number,"total_original": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"currency"?: string,"id"?: string,"invoice_date"?: string,"invoice_no"?: string | null,"lab_id": string,"note"?: string | null,"period_end": string,"period_start": string,"rate"?: number,"total_original": number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"currency"?: string,"id"?: string,"invoice_date"?: string,"invoice_no"?: string | null,"lab_id"?: string,"note"?: string | null,"period_end"?: string,"period_start"?: string,"rate"?: number,"total_original"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_statements_clinic_id_lab_id_fkey"
      columns: ["clinic_id","lab_id"]
isOneToOne: false
      referencedRelation: "labs"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"labs": {
                  Row: {
                    "active": boolean,"clinic_id": string,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"clinic_id": string,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"clinic_id"?: string,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labs_clinic_id_fkey"
      columns: ["clinic_id"]
isOneToOne: false
      referencedRelation: "clinics"
      referencedColumns: ["id"]
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
                },"payment_installments": {
                  Row: {
                    "amount": number,"clinic_id": string,"due_date": string,"id": string,"plan_id": string,"seq": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"clinic_id": string,"due_date": string,"id"?: string,"plan_id": string,"seq": number
                  }
                  Update: {
                    "amount"?: number,"clinic_id"?: string,"due_date"?: string,"id"?: string,"plan_id"?: string,"seq"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_installments_clinic_id_plan_id_fkey"
      columns: ["clinic_id","plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"payment_plans": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"created_by_name": string | null,"id": string,"note": string | null,"patient_id": string,"title": string,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"id"?: string,"note"?: string | null,"patient_id": string,"title"?: string,"total": number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"id"?: string,"note"?: string | null,"patient_id"?: string,"title"?: string,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_plans_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "payment_plans_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
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
                    "appointment_id": string | null,"clinic_id": string,"counted_quantity": number | null,"created_at": string,"created_by": string | null,"expiry_date": string | null,"id": string,"item_id": string,"kind": Database["public"]['Enums']["stock_movement_kind"],"lot_no": string | null,"note": string | null,"patient_id": string | null,"quantity": number,"treatment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"clinic_id": string,"counted_quantity"?: number | null,"created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_id": string,"kind": Database["public"]['Enums']["stock_movement_kind"],"lot_no"?: string | null,"note"?: string | null,"patient_id"?: string | null,"quantity": number,"treatment_id"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"clinic_id"?: string,"counted_quantity"?: number | null,"created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["stock_movement_kind"],"lot_no"?: string | null,"note"?: string | null,"patient_id"?: string | null,"quantity"?: number,"treatment_id"?: string | null
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
    },{
      foreignKeyName: "stock_movements_clinic_id_treatment_id_fkey"
      columns: ["clinic_id","treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
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
                },"treatment_discounts": {
                  Row: {
                    "clinic_id": string,"created_at": string,"created_by": string | null,"created_by_name": string | null,"id": string,"mode": string,"patient_id": string,"plan_id": string,"total_after": number,"total_before": number,"treatment_ids": (string)[],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"id"?: string,"mode": string,"patient_id": string,"plan_id": string,"total_after": number,"total_before": number,"treatment_ids": (string)[],"value": number
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"id"?: string,"mode"?: string,"patient_id"?: string,"plan_id"?: string,"total_after"?: number,"total_before"?: number,"treatment_ids"?: (string)[],"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_discounts_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "treatment_discounts_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatment_discounts_clinic_id_plan_id_fkey"
      columns: ["clinic_id","plan_id"]
isOneToOne: false
      referencedRelation: "treatment_plans"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"treatment_expenses": {
                  Row: {
                    "amount": number,"amount_original": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"clinic_id": string,"created_at": string,"created_by": string | null,"created_by_name": string | null,"currency": string,"description": string | null,"id": string,"lab_id": string | null,"rate": number,"statement_id": string | null,"treatment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_original": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id": string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"lab_id"?: string | null,"rate": number,"statement_id"?: string | null,"treatment_id": string
                  }
                  Update: {
                    "amount"?: number,"amount_original"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"lab_id"?: string | null,"rate"?: number,"statement_id"?: string | null,"treatment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_expenses_clinic_id_lab_id_fkey"
      columns: ["clinic_id","lab_id"]
isOneToOne: false
      referencedRelation: "labs"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatment_expenses_clinic_id_statement_id_fkey"
      columns: ["clinic_id","statement_id"]
isOneToOne: false
      referencedRelation: "lab_statements"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatment_expenses_clinic_id_treatment_id_fkey"
      columns: ["clinic_id","treatment_id"]
isOneToOne: false
      referencedRelation: "treatments"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"treatment_plan_approvals": {
                  Row: {
                    "clinic_id": string,"id": string,"items": NonNullable<Json>,"patient_id": string,"patient_name": string,"plan_id": string,"plan_title": string,"recorded_by": string | null,"recorded_by_name": string | null,"signature": NonNullable<Json>,"signed_at": string,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"id"?: string,"items": NonNullable<Json>,"patient_id": string,"patient_name": string,"plan_id": string,"plan_title": string,"recorded_by"?: string | null,"recorded_by_name"?: string | null,"signature": NonNullable<Json>,"signed_at"?: string,"total": number
                  }
                  Update: {
                    "clinic_id"?: string,"id"?: string,"items"?: NonNullable<Json>,"patient_id"?: string,"patient_name"?: string,"plan_id"?: string,"plan_title"?: string,"recorded_by"?: string | null,"recorded_by_name"?: string | null,"signature"?: NonNullable<Json>,"signed_at"?: string,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_plan_approvals_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "treatment_plan_approvals_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatment_plan_approvals_clinic_id_plan_id_fkey"
      columns: ["clinic_id","plan_id"]
isOneToOne: false
      referencedRelation: "treatment_plans"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"treatment_plans": {
                  Row: {
                    "clinic_id": string,"created_at": string,"created_by": string | null,"doctor_member_id": string,"id": string,"is_active": boolean,"locked_at": string | null,"locked_by": string | null,"locked_by_name": string | null,"patient_id": string,"title": string,"unlocked_at": string | null,"unlocked_by": string | null,"unlocked_by_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"created_by"?: string | null,"doctor_member_id": string,"id"?: string,"is_active"?: boolean,"locked_at"?: string | null,"locked_by"?: string | null,"locked_by_name"?: string | null,"patient_id": string,"title": string,"unlocked_at"?: string | null,"unlocked_by"?: string | null,"unlocked_by_name"?: string | null
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"doctor_member_id"?: string,"id"?: string,"is_active"?: boolean,"locked_at"?: string | null,"locked_by"?: string | null,"locked_by_name"?: string | null,"patient_id"?: string,"title"?: string,"unlocked_at"?: string | null,"unlocked_by"?: string | null,"unlocked_by_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_plans_clinic_id_doctor_member_id_fkey"
      columns: ["clinic_id","doctor_member_id"]
isOneToOne: false
      referencedRelation: "clinic_members"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatment_plans_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patient_balances"
      referencedColumns: ["clinic_id","patient_id"]
    },{
      foreignKeyName: "treatment_plans_clinic_id_patient_id_fkey"
      columns: ["clinic_id","patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["clinic_id","id"]
    }
                  ]
                },"treatments": {
                  Row: {
                    "amount": number | null,"clinic_id": string,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"doctor_member_id": string,"id": string,"kind": Database["public"]['Enums']["treatment_kind"],"list_amount": number | null,"note": string | null,"patient_id": string,"performed_on": string,"plan_id": string,"price_item_id": string | null,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"clinic_id": string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"doctor_member_id": string,"id"?: string,"kind": Database["public"]['Enums']["treatment_kind"],"list_amount"?: number | null,"note"?: string | null,"patient_id": string,"performed_on": string,"plan_id": string,"price_item_id"?: string | null,"procedure": string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
                  }
                  Update: {
                    "amount"?: number | null,"clinic_id"?: string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"doctor_member_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["treatment_kind"],"list_amount"?: number | null,"note"?: string | null,"patient_id"?: string,"performed_on"?: string,"plan_id"?: string,"price_item_id"?: string | null,"procedure"?: string,"status"?: Database["public"]['Enums']["treatment_status"],"tooth"?: string | null
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
    },{
      foreignKeyName: "treatments_clinic_id_plan_id_fkey"
      columns: ["clinic_id","plan_id"]
isOneToOne: false
      referencedRelation: "treatment_plans"
      referencedColumns: ["clinic_id","id"]
    },{
      foreignKeyName: "treatments_clinic_id_price_item_id_fkey"
      columns: ["clinic_id","price_item_id"]
isOneToOne: false
      referencedRelation: "price_list_items"
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
                },"installment_status": {
                  Row: {
                    "amount": number,"clinic_id": string,"count": number | null,"due_date": string,"id": string,"paid": number | null,"patient_id": string,"plan_id": string,"plan_title": string,"seq": number,"status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "payment_installments_clinic_id_plan_id_fkey"
      columns: ["clinic_id","plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["clinic_id","id"]
    }
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
"add_treatment_expense":
{ Args: { "p_amount_original": number,"p_currency": string,"p_description": string,"p_lab": string,"p_lab_name": string,"p_rate": number,"p_treatment": string }; Returns: string
                           },
"apply_plan_discount":
{ Args: { "p_mode": string,"p_plan": string,"p_treatments": (string)[],"p_value": number }; Returns: undefined
                           },
"cancel_lab_statement":
{ Args: { "p_reason": string,"p_statement": string }; Returns: undefined
                           },
"cancel_payment_plan":
{ Args: { "p_plan": string,"p_reason": string }; Returns: undefined
                           },
"cancel_treatment_expense":
{ Args: { "p_expense": string,"p_reason": string }; Returns: undefined
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
"copy_treatment_plan":
{ Args: { "p_plan": string,"p_title": string }; Returns: string
                           },
"correct_attendance":
{ Args: { "p_id": string,"p_in": string,"p_out": string,"p_reason": string }; Returns: undefined
                           },
"create_device_pairing":
{ Args: { "p_clinic": string,"p_name": string }; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"create_lab_statement":
{ Args: { "p_clinic": string,"p_currency": string,"p_from": string,"p_invoice_date": string,"p_invoice_no": string,"p_items": Json,"p_lab": string,"p_lab_name": string,"p_note": string,"p_rate": number,"p_to": string,"p_total": number }; Returns: string
                           },
"create_payment_plan":
{ Args: { "p_installments": Json,"p_note": string,"p_patient": string,"p_title": string }; Returns: string
                           },
"delete_treatment_plan":
{ Args: { "p_plan": string }; Returns: undefined
                           },
"device_pairing_valid":
{ Args: { "p_code": string }; Returns: boolean
                           },
"kiosk_current_code":
{ Args: Record<PropertyKey, never>; Returns: {
              "clinic_name": string,"code": string,"expires_at": string,"qr": string
            }[]
                           },
"lab_candidates":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "doctor_member_id": string,"doctor_name": string,"expensed": number,"kind": Database["public"]['Enums']["treatment_kind"],"patient_name": string,"performed_on": string,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string,"treatment_id": string
            }[]
                           },
"link_visit_materials":
{ Args: { "p_appointment": string,"p_links": Json }; Returns: undefined
                           },
"lock_treatment_plan":
{ Args: { "p_plan": string }; Returns: undefined
                           },
"plan_profitability":
{ Args: { "p_plan": string }; Returns: {
              "commission": number,"commission_rate": number,"lab": number,"material": number,"material_unpriced": boolean,"procedure": string,"profit": number,"revenue": number,"status": Database["public"]['Enums']["treatment_status"],"tooth": string,"treatment_id": string
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
"report_expenses":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"day": string,"detail": string,"doctor_name": string,"kind": string,"label": string,"ref": string
            }[]
                           },
"report_payments":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"patient_id": string,"patient_name": string,"received_by_name": string
            }[]
                           },
"report_unfinished_plans":
{ Args: { "p_clinic": string,"p_from": string,"p_to": string }; Returns: {
              "doctor_member_id": string,"doctor_name": string,"done_amount": number,"done_items": number,"kinds": (Database["public"]['Enums']["treatment_kind"])[],"last_done_at": string,"locked": boolean,"next_appointment": string,"patient_id": string,"patient_name": string,"patient_phone": string,"plan_created_at": string,"plan_id": string,"plan_title": string,"started_items": number,"total_amount": number,"total_items": number
            }[]
                           },
"revoke_device":
{ Args: { "p_member": string }; Returns: undefined
                           },
"set_active_treatment_plan":
{ Args: { "p_plan": string }; Returns: undefined
                           },
"set_commission_rate":
{ Args: { "p_member": string,"p_rate": number }; Returns: undefined
                           },
"set_discount_limit":
{ Args: { "p_clinic": string,"p_pct": number }; Returns: undefined
                           },
"sign_treatment_plan":
{ Args: { "p_plan": string,"p_signature": Json }; Returns: string
                           },
"treatment_summaries":
{ Args: { "p_patient": string }; Returns: {
              "amount": number,"doctor_name": string,"id": string,"kind": Database["public"]['Enums']["treatment_kind"],"list_amount": number,"performed_on": string,"plan_id": string,"procedure": string,"status": Database["public"]['Enums']["treatment_status"],"tooth": string
            }[]
                           },
"unlock_treatment_plan":
{ Args: { "p_plan": string }; Returns: undefined
                           }
          }
          Enums: {
            "appointment_status": "bekliyor"|"onaylandi"|"tamamlandi"|"gelmedi"|"iptal","clinic_role": "sahip"|"yonetici"|"hekim"|"resepsiyonist"|"asistan"|"ekran"|"muhasebe","gender": "kadin"|"erkek"|"belirtilmedi","media_review_status": "inceleme_bekliyor"|"onaylandi"|"tekrar_istendi","member_status": "aktif"|"pasif","note_kind": "klinik"|"randevu"|"odeme","payment_method": "nakit"|"kredi_karti"|"havale"|"diger","radiograph_kind": "panoramik"|"periapikal"|"bitewing"|"sefalometrik"|"diger"|"agiz_ici_fotograf","radiograph_purpose": "tedavi_oncesi"|"tedavi_sonrasi"|"kontrol"|"teshis","stock_category": "sarf"|"anestezik"|"dolgu"|"implant"|"frez_alet"|"sterilizasyon"|"ortodonti"|"diger","stock_movement_kind": "giris"|"kullanim"|"sayim"|"fire","task_priority": "yuksek"|"normal","treatment_kind": "muayene"|"rontgen"|"temizlik"|"dolgu"|"kanal"|"cekim"|"implant"|"kron_kopru"|"protez"|"dis_eti"|"ortodonti"|"beyazlatma"|"cerrahi"|"diger","treatment_status": "planlandi"|"devam"|"tamamlandi","visit_type": "muayene"|"tedavi"|"kontrol"|"cerrahi"|"diger"
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
            "appointment_status": ["bekliyor", "onaylandi", "tamamlandi", "gelmedi", "iptal"],"clinic_role": ["sahip", "yonetici", "hekim", "resepsiyonist", "asistan", "ekran", "muhasebe"],"gender": ["kadin", "erkek", "belirtilmedi"],"media_review_status": ["inceleme_bekliyor", "onaylandi", "tekrar_istendi"],"member_status": ["aktif", "pasif"],"note_kind": ["klinik", "randevu", "odeme"],"payment_method": ["nakit", "kredi_karti", "havale", "diger"],"radiograph_kind": ["panoramik", "periapikal", "bitewing", "sefalometrik", "diger", "agiz_ici_fotograf"],"radiograph_purpose": ["tedavi_oncesi", "tedavi_sonrasi", "kontrol", "teshis"],"stock_category": ["sarf", "anestezik", "dolgu", "implant", "frez_alet", "sterilizasyon", "ortodonti", "diger"],"stock_movement_kind": ["giris", "kullanim", "sayim", "fire"],"task_priority": ["yuksek", "normal"],"treatment_kind": ["muayene", "rontgen", "temizlik", "dolgu", "kanal", "cekim", "implant", "kron_kopru", "protez", "dis_eti", "ortodonti", "beyazlatma", "cerrahi", "diger"],"treatment_status": ["planlandi", "devam", "tamamlandi"],"visit_type": ["muayene", "tedavi", "kontrol", "cerrahi", "diger"]
          }
        }
} as const
