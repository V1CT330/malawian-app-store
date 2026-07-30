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
      install_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: string
          listing_id: string
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          listing_id: string
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          listing_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "install_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          created_at: string
          document_url: string | null
          full_name: string
          id: string
          id_number: string
          id_type: string
          notes: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          full_name: string
          id?: string
          id_number: string
          id_type: string
          notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          full_name?: string
          id?: string
          id_number?: string
          id_type?: string
          notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_versions: {
        Row: {
          changelog: string | null
          created_at: string
          file_url: string | null
          id: string
          listing_id: string
          size_bytes: number | null
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          listing_id: string
          size_bytes?: number | null
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          listing_id?: string
          size_bytes?: number | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_versions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          developer_id: string
          downloads: number
          featured: boolean
          icon_url: string | null
          id: string
          kind: Database["public"]["Enums"]["listing_kind"]
          name: string
          price_mwk: number
          rating_avg: number
          rating_count: number
          rejection_reason: string | null
          screenshots: string[]
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          tagline: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          developer_id: string
          downloads?: number
          featured?: boolean
          icon_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["listing_kind"]
          name: string
          price_mwk?: number
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          screenshots?: string[]
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          developer_id?: string
          downloads?: number
          featured?: boolean
          icon_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["listing_kind"]
          name?: string
          price_mwk?: number
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          screenshots?: string[]
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          developer_name: string | null
          display_name: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_developer: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          linkedin_url: string | null
          mode: string
          phone: string | null
          phone_verified: boolean
          suspended: boolean
          updated_at: string
          website_url: string | null
          whatsapp_url: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          developer_name?: string | null
          display_name?: string | null
          facebook_url?: string | null
          id: string
          instagram_url?: string | null
          is_developer?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          linkedin_url?: string | null
          mode?: string
          phone?: string | null
          phone_verified?: boolean
          suspended?: boolean
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          developer_name?: string | null
          display_name?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_developer?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          linkedin_url?: string | null
          mode?: string
          phone?: string | null
          phone_verified?: boolean
          suspended?: boolean
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          kind: string
          listing_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          listing_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          listing_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_mwk: number
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_mwk?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_mwk?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      view_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: string
          listing_id: string
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          listing_id: string
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          listing_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status: "none" | "pending" | "approved" | "rejected"
      listing_kind: "app" | "website"
      listing_status: "draft" | "pending" | "published" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      kyc_status: ["none", "pending", "approved", "rejected"],
      listing_kind: ["app", "website"],
      listing_status: ["draft", "pending", "published", "rejected"],
    },
  },
} as const
