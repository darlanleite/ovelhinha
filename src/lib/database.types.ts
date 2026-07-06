export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Tipos mantidos à mão a partir do schema documentado (CLAUDE.md + migrações).
// Quando o projeto Supabase estiver acessível, regenerar com:
//   npx supabase gen types typescript --project-id reefzadzwbmhkojtjqhz > src/lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      churches: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['churches']['Insert']>
        Relationships: []
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
        Update: Partial<Database['public']['Tables']['church_settings']['Insert']>
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          church_id: string
          name: string
          emoji: string
          age_range: string
          created_at: string
        }
        Insert: {
          id?: string
          church_id: string
          name: string
          emoji: string
          age_range: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
        Relationships: []
      }
      children: {
        Row: {
          id: string
          church_id: string
          name: string
          birth_date: string
          room_id: string
          medical_notes: string | null
          bracelet_number: string | null
          authorized_pickup: string | null
          status: 'present' | 'called' | 'left'
          checked_in_at: string
          created_at: string
        }
        Insert: {
          id?: string
          church_id: string
          name: string
          birth_date: string
          room_id: string
          medical_notes?: string | null
          bracelet_number?: string | null
          authorized_pickup?: string | null
          status?: 'present' | 'called' | 'left'
          checked_in_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['children']['Insert']>
        Relationships: []
      }
      guardians: {
        Row: {
          id: string
          child_id: string
          name: string
          phone: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          child_id: string
          name: string
          phone: string
          is_primary?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['guardians']['Insert']>
        Relationships: []
      }
      bracelets: {
        Row: {
          id: string
          church_id: string
          number: string
          esp_id: string | null
          status: 'available' | 'in-use' | 'charging' | 'offline'
          battery: number
          guardian_name: string | null
          child_id: string | null
          last_seen_at: string | null
          last_gateway_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          church_id: string
          number: string
          esp_id?: string | null
          status?: 'available' | 'in-use' | 'charging' | 'offline'
          battery?: number
          guardian_name?: string | null
          child_id?: string | null
          last_seen_at?: string | null
          last_gateway_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['bracelets']['Insert']>
        Relationships: []
      }
      calls: {
        Row: {
          id: string
          church_id: string
          child_id: string
          bracelet_number: string
          room_id: string
          reason: string
          reason_icon: string
          status: 'open' | 'answered' | 'reactivated'
          answered_by: 'reception' | 'tia' | null
          created_at: string
          answered_at: string | null
        }
        Insert: {
          id?: string
          church_id: string
          child_id: string
          bracelet_number: string
          room_id: string
          reason: string
          reason_icon: string
          status?: 'open' | 'answered' | 'reactivated'
          answered_by?: 'reception' | 'tia' | null
          created_at?: string
          answered_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['calls']['Insert']>
        Relationships: []
      }
      service_history: {
        Row: {
          id: string
          church_id: string
          service_date: string
          service_name: string
          children_count: number
          calls_count: number
          created_at: string
        }
        Insert: {
          id?: string
          church_id: string
          service_date: string
          service_name: string
          children_count: number
          calls_count: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['service_history']['Insert']>
        Relationships: []
      }
      gateway_commands: {
        Row: {
          id: string
          church_id: string
          bracelet_id: string
          command: 'acionar' | 'encerrar'
          reason: string | null
          status: 'pending' | 'sent' | 'failed'
          attempts: number
          created_at: string
          sent_at: string | null
          gateway_id: string | null
          delivered_at: string | null
        }
        Insert: {
          id?: string
          church_id: string
          bracelet_id: string
          command: 'acionar' | 'encerrar'
          reason?: string | null
          status?: 'pending' | 'sent' | 'failed'
          attempts?: number
          created_at?: string
          sent_at?: string | null
          gateway_id?: string | null
          delivered_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['gateway_commands']['Insert']>
        Relationships: []
      }
      gateways: {
        Row: {
          id: string
          church_id: string
          name: string
          last_seen: string | null
        }
        Insert: {
          id?: string
          church_id: string
          name?: string
          last_seen?: string | null
        }
        Update: Partial<Database['public']['Tables']['gateways']['Insert']>
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          church_id: string
          device_id: string
          role: string
          room_id: string | null
          subscription: Json
          updated_at: string
        }
        Insert: {
          id?: string
          church_id: string
          device_id: string
          role: string
          room_id?: string | null
          subscription: Json
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          church_id: string
          role: 'admin' | 'reception'
          name: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          church_id: string
          role: 'admin' | 'reception'
          name?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      tia_sessions: {
        Row: {
          user_id: string
          church_id: string
          room_id: string | null
          created_at: string
          expires_at: string
        }
        Insert: {
          user_id: string
          church_id: string
          room_id?: string | null
          created_at?: string
          expires_at: string
        }
        Update: Partial<Database['public']['Tables']['tia_sessions']['Insert']>
        Relationships: []
      }
    }
    Functions: {
      answer_call: {
        Args: { p_call_id: string; p_answered_by: string }
        Returns: undefined
      }
      tia_claim: {
        Args: { p_code: string }
        Returns: Json
      }
      tia_set_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    Views: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
