// Gerado a partir do schema do Supabase (supabase gen types typescript).
// Regenerar após cada migração: npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type InviteRow = {
  created_at: string;
  expires_at: string;
  id: string;
  label: string | null;
  personal_id: string;
  revoked_at: string | null;
  token: string;
  used_at: string | null;
  used_by: string | null;
};

type TransferRow = {
  created_at: string;
  from_personal_id: string;
  id: string;
  kind: Database["public"]["Enums"]["transfer_kind"];
  responded_at: string | null;
  status: Database["public"]["Enums"]["transfer_status"];
  student_id: string;
  to_personal_id: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      equipment: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          image_credit: string | null;
          image_path: string | null;
          image_updated_at: string | null;
          image_updated_by: string | null;
          image_url: string | null;
          is_bodyweight: boolean;
          is_default: boolean;
          muscle_group: Database["public"]["Enums"]["muscle_group"];
          name: string;
          updated_at: string;
        };
        Insert: {
          created_by: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_bodyweight?: boolean;
          muscle_group: Database["public"]["Enums"]["muscle_group"];
          name: string;
        };
        Update: {
          description?: string | null;
          image_path?: string | null;
          is_bodyweight?: boolean;
          muscle_group?: Database["public"]["Enums"]["muscle_group"];
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: InviteRow;
        Insert: Partial<InviteRow> & { expires_at: string; personal_id: string };
        Update: Partial<InviteRow>;
        Relationships: [
          {
            foreignKeyName: "invites_personal_id_fkey";
            columns: ["personal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: { read_at?: string | null };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_students: {
        Row: {
          archived_at: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          personal_id: string;
          role: Database["public"]["Enums"]["link_role"];
          status: Database["public"]["Enums"]["link_status"];
          student_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          personal_id: string;
          role: Database["public"]["Enums"]["link_role"];
          status?: Database["public"]["Enums"]["link_status"];
          student_id: string;
        };
        Update: { archived_at?: string | null };
        Relationships: [
          {
            foreignKeyName: "personal_students_personal_id_fkey";
            columns: ["personal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          terms_accepted_at: string | null;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          email: string;
          full_name: string;
          id: string;
          phone?: string | null;
          role: Database["public"]["Enums"]["user_role"];
          terms_accepted_at?: string | null;
        };
        Update: {
          birth_date?: string | null;
          full_name?: string;
          phone?: string | null;
        };
        Relationships: Rel[];
      };
      student_transfers: {
        Row: TransferRow;
        Insert: Partial<TransferRow> & {
          from_personal_id: string;
          kind: Database["public"]["Enums"]["transfer_kind"];
          student_id: string;
          to_personal_id: string;
        };
        Update: Partial<TransferRow>;
        Relationships: [
          {
            foreignKeyName: "student_transfers_from_personal_id_fkey";
            columns: ["from_personal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_transfers_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_transfers_to_personal_id_fkey";
            columns: ["to_personal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_plans: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          goal: string | null;
          id: string;
          is_template: boolean;
          name: string;
          notes: string | null;
          student_id: string | null;
          updated_at: string;
          valid_until: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "workout_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_plan_items: {
        Row: {
          equipment_id: string;
          id: string;
          notes: string | null;
          plan_id: string;
          position: number;
          reps_max: number | null;
          reps_min: number | null;
          rest_seconds: number;
          sets: number;
          suggested_load: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "workout_plan_items_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_plan_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sessions: {
        Row: {
          client_id: string;
          created_at: string;
          duration_seconds: number;
          finished_at: string;
          id: string;
          kind: Database["public"]["Enums"]["session_kind"];
          logged_by: string | null;
          notes: string | null;
          plan_id: string | null;
          plan_name: string | null;
          started_at: string;
          student_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "workout_sessions_logged_by_fkey";
            columns: ["logged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      session_sets: {
        Row: {
          done: boolean;
          equipment_id: string;
          exercise_order: number;
          id: string;
          is_pr: boolean;
          load_kg: number;
          reps: number;
          session_id: string;
          set_number: number;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "session_sets_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_sets_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      student_settings: {
        Row: {
          student_id: string;
          updated_at: string;
          weigh_in_frequency: Database["public"]["Enums"]["weigh_in_frequency"];
          weight_visible_to_personal: boolean;
        };
        Insert: {
          student_id: string;
          weigh_in_frequency?: Database["public"]["Enums"]["weigh_in_frequency"];
          weight_visible_to_personal?: boolean;
        };
        Update: {
          weigh_in_frequency?: Database["public"]["Enums"]["weigh_in_frequency"];
          weight_visible_to_personal?: boolean;
        };
        Relationships: [];
      };
      body_weights: {
        Row: {
          created_at: string;
          id: string;
          measured_on: string;
          student_id: string;
          weight_kg: number;
        };
        Insert: {
          measured_on?: string;
          student_id: string;
          weight_kg: number;
        };
        Update: { weight_kg?: number };
        Relationships: [];
      };
      class_schedules: {
        Row: {
          created_at: string;
          duration_minutes: number;
          ends_on: string | null;
          id: string;
          notes: string | null;
          personal_id: string;
          start_time: string;
          starts_on: string;
          student_id: string;
          weekday: number;
        };
        Insert: {
          duration_minutes?: number;
          ends_on?: string | null;
          notes?: string | null;
          personal_id: string;
          start_time: string;
          starts_on?: string;
          student_id: string;
          weekday: number;
        };
        Update: { start_time?: string; duration_minutes?: number; ends_on?: string | null; notes?: string | null };
        Relationships: [
          {
            foreignKeyName: "class_schedules_personal_id_fkey";
            columns: ["personal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_schedules_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_exceptions: {
        Row: { created_at: string; id: string; on_date: string; reason: string | null; schedule_id: string };
        Insert: { on_date: string; reason?: string | null; schedule_id: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cancel_student_transfer: { Args: { p_transfer: string }; Returns: undefined };
      create_invite: {
        Args: { p_days?: number; p_label?: string };
        Returns: InviteRow;
        SetofOptions: { from: "*"; to: "invites"; isOneToOne: true; isSetofReturn: false };
      };
      current_role_is: {
        Args: { r: Database["public"]["Enums"]["user_role"] };
        Returns: boolean;
      };
      find_personal_by_email: {
        Args: { p_email: string };
        Returns: { full_name: string; id: string }[];
      };
      get_invite_public: {
        Args: { p_token: string };
        Returns: { expires_at: string; personal_name: string; status: string }[];
      };
      knows_personal: { Args: { p: string }; Returns: boolean };
      is_linked_personal: { Args: { p_student: string }; Returns: boolean };
      is_responsible_personal: { Args: { p_student: string }; Returns: boolean };
      request_student_transfer: {
        Args: {
          p_kind: Database["public"]["Enums"]["transfer_kind"];
          p_student: string;
          p_to_personal: string;
        };
        Returns: TransferRow;
        SetofOptions: {
          from: "*";
          to: "student_transfers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      respond_student_transfer: {
        Args: { p_accept: boolean; p_transfer: string };
        Returns: undefined;
      };
      revoke_invite: { Args: { p_invite: string }; Returns: undefined };
      revoke_student_share: {
        Args: { p_personal: string; p_student: string };
        Returns: undefined;
      };
      daily_class_reminders: {
        Args: { p_date: string };
        Returns: {
          personal_id: string;
          personal_name: string;
          personal_email: string;
          classes: Json;
          notified: boolean;
        }[];
      };
      set_equipment_image: {
        Args: { p_equipment: string; p_image_path: string | null };
        Returns: undefined;
      };
      weigh_in_status: {
        Args: { p_student: string };
        Returns: {
          frequency: Database["public"]["Enums"]["weigh_in_frequency"];
          last_measured_on: string | null;
          due_on: string | null;
          overdue: boolean;
        }[];
      };
      can_view_weight: { Args: { p_student: string }; Returns: boolean };
      save_workout_session: {
        Args: { p: Json };
        Returns: Json;
      };
      can_view_session: { Args: { p_session: string }; Returns: boolean };
      save_workout_plan: {
        Args: {
          p_plan: string | null;
          p_student: string | null;
          p_name: string;
          p_goal: string | null;
          p_notes: string | null;
          p_valid_until: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      duplicate_workout_plan: {
        Args: { p_plan: string; p_student: string | null; p_name?: string | null };
        Returns: string;
      };
      set_workout_plan_archived: {
        Args: { p_plan: string; p_archived: boolean };
        Returns: undefined;
      };
      can_view_plan: { Args: { p_plan: string }; Returns: boolean };
      can_edit_plan: { Args: { p_plan: string }; Returns: boolean };
      set_student_archived: {
        Args: { p_archived: boolean; p_student: string };
        Returns: undefined;
      };
    };
    Enums: {
      link_role: "responsavel" | "compartilhado";
      session_kind: "ficha" | "livre";
      weigh_in_frequency: "semanal" | "quinzenal";
      muscle_group:
        | "peito"
        | "costas"
        | "ombros"
        | "biceps"
        | "triceps"
        | "antebraco"
        | "quadriceps"
        | "posterior"
        | "gluteos"
        | "adutores"
        | "panturrilha"
        | "abdomen"
        | "cardio"
        | "corpo_inteiro";
      link_status: "ativo" | "revogado";
      transfer_kind: "compartilhamento" | "transferencia";
      transfer_status: "pendente" | "aceito" | "recusado" | "cancelado";
      user_role: "personal" | "aluno";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
