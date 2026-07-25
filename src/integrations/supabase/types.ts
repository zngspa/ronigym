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
      attendance: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          lesson_id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          lesson_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_categories: {
        Row: {
          coach_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category_id: string | null
          coach_id: string
          created_at: string
          default_duration_seconds: number
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          coach_id: string
          created_at?: string
          default_duration_seconds?: number
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          coach_id?: string
          created_at?: string
          default_duration_seconds?: number
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "exercise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      google_accounts: {
        Row: {
          access_token: string
          coach_id: string
          created_at: string
          expires_at: string | null
          google_email: string | null
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          coach_id: string
          created_at?: string
          expires_at?: string | null
          google_email?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          coach_id?: string
          created_at?: string
          expires_at?: string | null
          google_email?: string | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          coach_id: string
          group_id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          coach_id: string
          group_id: string
          joined_at?: string
          student_id: string
        }
        Update: {
          coach_id?: string
          group_id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          coach_id: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          schedule_notes: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          schedule_notes?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          schedule_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          coach_id: string
          created_at: string
          end_time: string | null
          group_id: string
          id: string
          lesson_date: string
          location: string | null
          notes: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_time?: string | null
          group_id: string
          id?: string
          lesson_date: string
          location?: string | null
          notes?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_time?: string | null
          group_id?: string
          id?: string
          lesson_date?: string
          location?: string | null
          notes?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          coach_id: string
          created_at: string
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          period_end: string | null
          period_start: string | null
          student_id: string
        }
        Insert: {
          amount: number
          coach_id: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          coach_id?: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          active: boolean | null
          address: string | null
          birth_date: string | null
          blood_type: string | null
          coach_id: string
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          health_approval: boolean | null
          health_approval_expiry: string | null
          health_notes: string | null
          id: string
          id_number: string | null
          monthly_fee: number | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          blood_type?: string | null
          coach_id: string
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          health_approval?: boolean | null
          health_approval_expiry?: string | null
          health_notes?: string | null
          id?: string
          id_number?: string | null
          monthly_fee?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          blood_type?: string | null
          coach_id?: string
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          health_approval?: boolean | null
          health_approval_expiry?: string | null
          health_notes?: string | null
          id?: string
          id_number?: string | null
          monthly_fee?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workout_plan_items: {
        Row: {
          coach_id: string
          created_at: string
          duration_seconds: number | null
          exercise_id: string
          id: string
          position: number
          rest_after_seconds: number | null
          workout_plan_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          position?: number
          rest_after_seconds?: number | null
          workout_plan_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          position?: number
          rest_after_seconds?: number | null
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_items_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          coach_id: string
          created_at: string
          default_rest_seconds: number
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          default_rest_seconds?: number
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          default_rest_seconds?: number
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
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
      attendance_status: "present" | "absent" | "late" | "excused"
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
    Enums: {
      attendance_status: ["present", "absent", "late", "excused"],
    },
  },
} as const
