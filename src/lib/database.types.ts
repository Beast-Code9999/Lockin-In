
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "checkin_notes": {
                  Row: {
                    "checkin_id": string,"note": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_id": string,"note": string,"user_id": string
                  }
                  Update: {
                    "checkin_id"?: string,"note"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkin_notes_checkin_id_fkey"
      columns: ["checkin_id"]
isOneToOne: true
      referencedRelation: "checkins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkin_notes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "created_at": string,"group_id": string,"id": string,"local_date": string,"points": number,"source": Database["public"]['Enums']["checkin_source"],"status": Database["public"]['Enums']["checkin_status"],"streak_after": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"group_id": string,"id"?: string,"local_date": string,"points"?: number,"source": Database["public"]['Enums']["checkin_source"],"status": Database["public"]['Enums']["checkin_status"],"streak_after"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"id"?: string,"local_date"?: string,"points"?: number,"source"?: Database["public"]['Enums']["checkin_source"],"status"?: Database["public"]['Enums']["checkin_status"],"streak_after"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "first_eligible_date": string | null,"group_id": string,"joined_at": string,"pact_accepted_at": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "first_eligible_date"?: string | null,"group_id": string,"joined_at"?: string,"pact_accepted_at"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "first_eligible_date"?: string | null,"group_id"?: string,"joined_at"?: string,"pact_accepted_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"invite_code": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"invite_code": string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"invite_code"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "auto_use_freeze": boolean,"avatar_id": string,"created_at": string,"display_name": string,"id": string,"notify_prefs": NonNullable<Json>,"phone": string | null,"reminder_time": string,"timezone": string,"tz_changed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_use_freeze"?: boolean,"avatar_id"?: string,"created_at"?: string,"display_name": string,"id": string,"notify_prefs"?: NonNullable<Json>,"phone"?: string | null,"reminder_time"?: string,"timezone"?: string,"tz_changed_at"?: string | null
                  }
                  Update: {
                    "auto_use_freeze"?: boolean,"avatar_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"notify_prefs"?: NonNullable<Json>,"phone"?: string | null,"reminder_time"?: string,"timezone"?: string,"tz_changed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"seasons": {
                  Row: {
                    "ends_on": string,"group_id": string,"id": string,"number": number,"results": Json | null,"starts_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"group_id": string,"id"?: string,"number": number,"results"?: Json | null,"starts_on": string,"status"?: string
                  }
                  Update: {
                    "ends_on"?: string,"group_id"?: string,"id"?: string,"number"?: number,"results"?: Json | null,"starts_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"user_stats": {
                  Row: {
                    "badge_counts": NonNullable<Json>,"boxes_completed": number,"challenges_done": number,"clown_until": string | null,"coward_until": string | null,"current_streak": number,"flame_tier": number,"freeze_tokens_left": number,"freeze_tokens_month": string | null,"group_id": string,"last_checkin_date": string | null,"longest_streak": number,"rank": string,"reroll_used_season_id": string | null,"score_30d": number,"season_points": number,"updated_at": string,"urges_defeated": number,"user_id": string,"wingman_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_counts"?: NonNullable<Json>,"boxes_completed"?: number,"challenges_done"?: number,"clown_until"?: string | null,"coward_until"?: string | null,"current_streak"?: number,"flame_tier"?: number,"freeze_tokens_left"?: number,"freeze_tokens_month"?: string | null,"group_id": string,"last_checkin_date"?: string | null,"longest_streak"?: number,"rank"?: string,"reroll_used_season_id"?: string | null,"score_30d"?: number,"season_points"?: number,"updated_at"?: string,"urges_defeated"?: number,"user_id": string,"wingman_count"?: number
                  }
                  Update: {
                    "badge_counts"?: NonNullable<Json>,"boxes_completed"?: number,"challenges_done"?: number,"clown_until"?: string | null,"coward_until"?: string | null,"current_streak"?: number,"flame_tier"?: number,"freeze_tokens_left"?: number,"freeze_tokens_month"?: string | null,"group_id"?: string,"last_checkin_date"?: string | null,"longest_streak"?: number,"rank"?: string,"reroll_used_season_id"?: string | null,"score_30d"?: number,"season_points"?: number,"updated_at"?: string,"urges_defeated"?: number,"user_id"?: string,"wingman_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_stats_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_stats_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vacations": {
                  Row: {
                    "cancelled_at": string | null,"created_at": string,"end_date": string,"id": string,"start_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"created_at"?: string,"end_date": string,"id"?: string,"start_date": string,"user_id": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"created_at"?: string,"end_date"?: string,"id"?: string,"start_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vacations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_pact":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"cancel_vacation":
{ Args: { "p_id": string }; Returns: Json
                           },
"check_in":
{ Args: { "p_local_date": string,"p_note"?: string,"p_source"?: Database["public"]['Enums']["checkin_source"],"p_status": Database["public"]['Enums']["checkin_status"] }; Returns: Json
                           },
"create_group":
{ Args: { "p_name": string,"p_timezone"?: string }; Returns: Json
                           },
"get_home":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"join_group":
{ Args: { "p_invite_code": string }; Returns: Json
                           },
"set_vacation":
{ Args: { "p_end": string,"p_start": string }; Returns: Json
                           },
"undo_slip":
{ Args: { "p_local_date": string }; Returns: Json
                           },
"update_profile":
{ Args: { "p_auto_use_freeze"?: boolean,"p_avatar_id"?: string,"p_display_name"?: string,"p_phone"?: string,"p_reminder_time"?: string,"p_timezone"?: string }; Returns: Json
                           }
          }
          Enums: {
            "box_status": "owed"|"opened"|"proof_submitted"|"confirmed"|"failed","checkin_source": "app"|"widget"|"backfill"|"system","checkin_status": "clean"|"relapse"|"missed"|"frozen"|"vacation","loot_status": "pending"|"approved"|"rejected","post_type": "story"|"feed"|"profile_pic","rarity": "common"|"rare"|"epic"|"legendary","sos_outcome": "held"|"relapsed"|"abandoned","vote_kind": "confirm"|"reject"
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
  "public": {
          Enums: {
            "box_status": ["owed", "opened", "proof_submitted", "confirmed", "failed"],"checkin_source": ["app", "widget", "backfill", "system"],"checkin_status": ["clean", "relapse", "missed", "frozen", "vacation"],"loot_status": ["pending", "approved", "rejected"],"post_type": ["story", "feed", "profile_pic"],"rarity": ["common", "rare", "epic", "legendary"],"sos_outcome": ["held", "relapsed", "abandoned"],"vote_kind": ["confirm", "reject"]
          }
        }
} as const
