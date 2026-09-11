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
      allocation_weights: {
        Row: {
          availability: number
          distance: number
          experience: number
          id: number
          rating: number
          recent_jobs: number
          skill: number
          updated_at: string
          workload: number
        }
        Insert: {
          availability?: number
          distance?: number
          experience?: number
          id?: number
          rating?: number
          recent_jobs?: number
          skill?: number
          updated_at?: string
          workload?: number
        }
        Update: {
          availability?: number
          distance?: number
          experience?: number
          id?: number
          rating?: number
          recent_jobs?: number
          skill?: number
          updated_at?: string
          workload?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_code: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          description: string
          fair_score: number | null
          id: string
          location: string
          payment: Database["public"]["Enums"]["payment_status"]
          price: number
          scheduled_date: string
          scheduled_time: string
          score_breakdown: Json | null
          service_id: string | null
          service_name: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          booking_code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string
          fair_score?: number | null
          id?: string
          location: string
          payment?: Database["public"]["Enums"]["payment_status"]
          price?: number
          scheduled_date: string
          scheduled_time: string
          score_breakdown?: Json | null
          service_id?: string | null
          service_name: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          booking_code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string
          fair_score?: number | null
          id?: string
          location?: string
          payment?: Database["public"]["Enums"]["payment_status"]
          price?: number
          scheduled_date?: string
          scheduled_time?: string
          score_breakdown?: Json | null
          service_id?: string | null
          service_name?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          rating: number
          worker_id: string
        }
        Insert: {
          booking_id?: string | null
          comment?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          rating: number
          worker_id: string
        }
        Update: {
          booking_id?: string | null
          comment?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          rating?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          active_jobs: number
          additional_skills: string[]
          availability: Database["public"]["Enums"]["availability_status"]
          bio: string
          completed_jobs: number
          created_at: string
          email: string | null
          experience_years: number
          full_name: string
          hourly_rate: number
          id: string
          languages: string[]
          latitude: number
          location: string
          longitude: number
          pending_jobs: number
          phone: string | null
          photo_url: string | null
          primary_skill: string
          rating: number
          rating_count: number
          recent_jobs: number
          service_radius_km: number
          total_earnings: number
          updated_at: string
          user_id: string | null
          verification: Database["public"]["Enums"]["verification_status"]
          working_hours: string
        }
        Insert: {
          active_jobs?: number
          additional_skills?: string[]
          availability?: Database["public"]["Enums"]["availability_status"]
          bio?: string
          completed_jobs?: number
          created_at?: string
          email?: string | null
          experience_years?: number
          full_name: string
          hourly_rate?: number
          id?: string
          languages?: string[]
          latitude?: number
          location?: string
          longitude?: number
          pending_jobs?: number
          phone?: string | null
          photo_url?: string | null
          primary_skill: string
          rating?: number
          rating_count?: number
          recent_jobs?: number
          service_radius_km?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string | null
          verification?: Database["public"]["Enums"]["verification_status"]
          working_hours?: string
        }
        Update: {
          active_jobs?: number
          additional_skills?: string[]
          availability?: Database["public"]["Enums"]["availability_status"]
          bio?: string
          completed_jobs?: number
          created_at?: string
          email?: string | null
          experience_years?: number
          full_name?: string
          hourly_rate?: number
          id?: string
          languages?: string[]
          latitude?: number
          location?: string
          longitude?: number
          pending_jobs?: number
          phone?: string | null
          photo_url?: string | null
          primary_skill?: string
          rating?: number
          rating_count?: number
          recent_jobs?: number
          service_radius_km?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string | null
          verification?: Database["public"]["Enums"]["verification_status"]
          working_hours?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "worker" | "customer"
      availability_status: "available" | "busy" | "unavailable"
      booking_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      payment_status: "unpaid" | "paid"
      verification_status: "pending" | "verified" | "rejected" | "suspended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "worker", "customer"],
      availability_status: ["available", "busy", "unavailable"],
      booking_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid"],
      verification_status: ["pending", "verified", "rejected", "suspended"],
    },
  },
} as const
