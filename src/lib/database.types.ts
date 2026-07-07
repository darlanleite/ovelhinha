export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_id: string | null
          actor_role: string
          child_id: string | null
          church_id: string
          created_at: string
          details: Json
          event_type: string
          id: number
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string
          child_id?: string | null
          church_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: never
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          child_id?: string | null
          church_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      bracelets: {
        Row: {
          battery: number
          child_id: string | null
          church_id: string
          created_at: string
          esp_id: string | null
          guardian_name: string | null
          id: string
          last_gateway_id: string | null
          last_seen_at: string | null
          number: string
          status: string
        }
        Insert: {
          battery?: number
          child_id?: string | null
          church_id: string
          created_at?: string
          esp_id?: string | null
          guardian_name?: string | null
          id?: string
          last_gateway_id?: string | null
          last_seen_at?: string | null
          number: string
          status?: string
        }
        Update: {
          battery?: number
          child_id?: string | null
          church_id?: string
          created_at?: string
          esp_id?: string | null
          guardian_name?: string | null
          id?: string
          last_gateway_id?: string | null
          last_seen_at?: string | null
          number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracelets_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracelets_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          bracelet_number: string
          child_id: string
          church_id: string
          created_at: string
          id: string
          reason: string
          reason_icon: string
          room_id: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          bracelet_number: string
          child_id: string
          church_id: string
          created_at?: string
          id?: string
          reason: string
          reason_icon?: string
          room_id: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          bracelet_number?: string
          child_id?: string
          church_id?: string
          created_at?: string
          id?: string
          reason?: string
          reason_icon?: string
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          authorized_pickup: string | null
          birth_date: string
          bracelet_number: string | null
          checked_in_at: string
          church_id: string
          consent_at: string | null
          consent_by_name: string | null
          created_at: string
          id: string
          medical_notes: string | null
          name: string
          room_id: string
          status: string
        }
        Insert: {
          authorized_pickup?: string | null
          birth_date: string
          bracelet_number?: string | null
          checked_in_at?: string
          church_id: string
          consent_at?: string | null
          consent_by_name?: string | null
          created_at?: string
          id?: string
          medical_notes?: string | null
          name: string
          room_id: string
          status?: string
        }
        Update: {
          authorized_pickup?: string | null
          birth_date?: string
          bracelet_number?: string | null
          checked_in_at?: string
          church_id?: string
          consent_at?: string | null
          consent_by_name?: string | null
          created_at?: string
          id?: string
          medical_notes?: string | null
          name?: string
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_settings: {
        Row: {
          church_id: string
          daily_code: string
          reactivate_minutes: number
        }
        Insert: {
          church_id: string
          daily_code?: string
          reactivate_minutes?: number
        }
        Update: {
          church_id?: string
          daily_code?: string
          reactivate_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "church_settings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      gateway_commands: {
        Row: {
          attempts: number
          bracelet_id: string
          church_id: string
          command: string
          created_at: string
          delivered_at: string | null
          gateway_id: string | null
          id: string
          reason: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          bracelet_id: string
          church_id: string
          command: string
          created_at?: string
          delivered_at?: string | null
          gateway_id?: string | null
          id?: string
          reason?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          bracelet_id?: string
          church_id?: string
          command?: string
          created_at?: string
          delivered_at?: string | null
          gateway_id?: string | null
          id?: string
          reason?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_commands_bracelet_id_fkey"
            columns: ["bracelet_id"]
            isOneToOne: false
            referencedRelation: "bracelets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_commands_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_commands_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateways: {
        Row: {
          church_id: string
          id: string
          last_seen: string | null
          name: string
        }
        Insert: {
          church_id: string
          id?: string
          last_seen?: string | null
          name?: string
        }
        Update: {
          church_id?: string
          id?: string
          last_seen?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateways_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          child_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          church_id: string
          created_at: string
          name: string | null
          role: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          name?: string | null
          role: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          name?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          church_id: string
          device_id: string
          id: string
          role: string
          room_id: string | null
          subscription: Json
          updated_at: string
        }
        Insert: {
          church_id: string
          device_id: string
          id?: string
          role: string
          room_id?: string | null
          subscription: Json
          updated_at?: string
        }
        Update: {
          church_id?: string
          device_id?: string
          id?: string
          role?: string
          room_id?: string | null
          subscription?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          age_range: string
          church_id: string
          created_at: string
          emoji: string
          id: string
          name: string
        }
        Insert: {
          age_range?: string
          church_id: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
        }
        Update: {
          age_range?: string
          church_id?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_history: {
        Row: {
          calls_count: number
          children_count: number
          church_id: string
          created_at: string
          id: string
          service_date: string
          service_name: string
        }
        Insert: {
          calls_count?: number
          children_count?: number
          church_id: string
          created_at?: string
          id?: string
          service_date: string
          service_name?: string
        }
        Update: {
          calls_count?: number
          children_count?: number
          church_id?: string
          created_at?: string
          id?: string
          service_date?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_history_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      tia_claim_attempts: {
        Row: {
          attempted_at: string
          id: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      tia_sessions: {
        Row: {
          church_id: string
          created_at: string
          expires_at: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          expires_at: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          expires_at?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tia_sessions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tia_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      answer_call: {
        Args: { p_answered_by: string; p_call_id: string }
        Returns: undefined
      }
      apply_retention: { Args: never; Returns: Json }
      audit_actor_role: { Args: never; Returns: string }
      audit_log: {
        Args: {
          p_child: string
          p_church: string
          p_details: Json
          p_type: string
        }
        Returns: undefined
      }
      checkout_child: {
        Args: { p_bracelet_number: string; p_child_id: string }
        Returns: Json
      }
      current_church_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      novo_culto: { Args: never; Returns: Json }
      tia_claim: { Args: { p_code: string }; Returns: Json }
      tia_set_room: { Args: { p_room_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
