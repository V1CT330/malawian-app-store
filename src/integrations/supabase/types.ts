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
      activity_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          listing_id: string | null
          owner_id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          listing_id?: string | null
          owner_id: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          owner_id?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          developer_id: string
          id: string
          listing_id: string | null
          pinned: boolean
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          developer_id: string
          id?: string
          listing_id?: string | null
          pinned?: boolean
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          developer_id?: string
          id?: string
          listing_id?: string | null
          pinned?: boolean
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          listing_id: string
          owner_id: string
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          listing_id: string
          owner_id: string
          severity?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string
          owner_id?: string
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_testers: {
        Row: {
          channel: string
          created_at: string
          email: string
          id: string
          listing_id: string
          owner_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          email: string
          id?: string
          listing_id: string
          owner_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          email?: string
          id?: string
          listing_id?: string
          owner_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_testers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          listing_id: string
          max_uses: number
          owner_id: string
          percent_off: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id: string
          max_uses?: number
          owner_id: string
          percent_off?: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id?: string
          max_uses?: number
          owner_id?: string
          percent_off?: number
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          body: string | null
          created_at: string
          id: string
          status: string
          title: string
          user_id: string
          vote_count: number
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          status?: string
          title: string
          user_id: string
          vote_count?: number
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          status?: string
          title?: string
          user_id?: string
          vote_count?: number
        }
        Relationships: []
      }
      feature_votes: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          developer_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
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
          channel: string
          created_at: string
          file_url: string | null
          id: string
          is_current: boolean
          listing_id: string
          release_notes: string | null
          scheduled_at: string | null
          size_bytes: number | null
          status: string
          version: string
        }
        Insert: {
          changelog?: string | null
          channel?: string
          created_at?: string
          file_url?: string | null
          id?: string
          is_current?: boolean
          listing_id: string
          release_notes?: string | null
          scheduled_at?: string | null
          size_bytes?: number | null
          status?: string
          version: string
        }
        Update: {
          changelog?: string | null
          channel?: string
          created_at?: string
          file_url?: string | null
          id?: string
          is_current?: boolean
          listing_id?: string
          release_notes?: string | null
          scheduled_at?: string | null
          size_bytes?: number | null
          status?: string
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
          allow_donations: boolean
          archived_at: string | null
          banner_url: string | null
          category: string
          created_at: string
          crypto_address: string | null
          description: string | null
          developer_id: string
          downloads: number
          featured: boolean
          icon_url: string | null
          id: string
          keywords: string[]
          kind: string
          monetization: string
          name: string
          price_month_mwk: number
          price_mwk: number
          price_year_mwk: number
          promo_images: string[]
          quality_score: number
          rating_avg: number
          rating_count: number
          rejection_reason: string | null
          screenshots: string[]
          seo_score: number
          slug: string
          sponsored: boolean
          status: string
          tagline: string | null
          tags: string[]
          updated_at: string
          video_url: string | null
          website_url: string | null
        }
        Insert: {
          allow_donations?: boolean
          archived_at?: string | null
          banner_url?: string | null
          category?: string
          created_at?: string
          crypto_address?: string | null
          description?: string | null
          developer_id: string
          downloads?: number
          featured?: boolean
          icon_url?: string | null
          id?: string
          keywords?: string[]
          kind?: string
          monetization?: string
          name: string
          price_month_mwk?: number
          price_mwk?: number
          price_year_mwk?: number
          promo_images?: string[]
          quality_score?: number
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          screenshots?: string[]
          seo_score?: number
          slug: string
          sponsored?: boolean
          status?: string
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          video_url?: string | null
          website_url?: string | null
        }
        Update: {
          allow_donations?: boolean
          archived_at?: string | null
          banner_url?: string | null
          category?: string
          created_at?: string
          crypto_address?: string | null
          description?: string | null
          developer_id?: string
          downloads?: number
          featured?: boolean
          icon_url?: string | null
          id?: string
          keywords?: string[]
          kind?: string
          monetization?: string
          name?: string
          price_month_mwk?: number
          price_mwk?: number
          price_year_mwk?: number
          promo_images?: string[]
          quality_score?: number
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          screenshots?: string[]
          seo_score?: number
          slug?: string
          sponsored?: boolean
          status?: string
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          video_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      login_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: string
          ip_hint: string | null
          platform: string | null
          session_active: boolean
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip_hint?: string | null
          platform?: string | null
          session_active?: boolean
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip_hint?: string | null
          platform?: string | null
          session_active?: boolean
          user_id?: string
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
      orders: {
        Row: {
          amount_mwk: number
          buyer_id: string | null
          commission_mwk: number
          country: string | null
          coupon_code: string | null
          created_at: string
          id: string
          kind: string
          listing_id: string
          method: string
          net_mwk: number
          provider_ref: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_mwk?: number
          buyer_id?: string | null
          commission_mwk?: number
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id: string
          method?: string
          net_mwk?: number
          provider_ref?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_mwk?: number
          buyer_id?: string | null
          commission_mwk?: number
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string
          method?: string
          net_mwk?: number
          provider_ref?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          created_at: string
          destination: string
          id: string
          is_default: boolean
          kind: string
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount_mwk: number
          created_at: string
          destination: string
          id: string
          method: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_mwk: number
          created_at?: string
          destination: string
          id?: string
          method?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_mwk?: number
          created_at?: string
          destination?: string
          id?: string
          method?: string
          notes?: string | null
          status?: string
          updated_at?: string
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
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          created_at: string
          developer_id: string
          id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          developer_id: string
          id?: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          developer_id?: string
          id?: string
          viewer_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          contact_email: string | null
          created_at: string
          developer_name: string | null
          developer_terms_accepted_at: string | null
          display_name: string | null
          facebook_url: string | null
          follower_count: number
          github_url: string | null
          id: string
          instagram_url: string | null
          is_developer: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          linkedin_url: string | null
          location: string | null
          mode: string
          phone: string | null
          phone_verified: boolean
          portfolio_url: string | null
          reputation_score: number
          skills: string[]
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
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          developer_name?: string | null
          developer_terms_accepted_at?: string | null
          display_name?: string | null
          facebook_url?: string | null
          follower_count?: number
          github_url?: string | null
          id: string
          instagram_url?: string | null
          is_developer?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          linkedin_url?: string | null
          location?: string | null
          mode?: string
          phone?: string | null
          phone_verified?: boolean
          portfolio_url?: string | null
          reputation_score?: number
          skills?: string[]
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
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          developer_name?: string | null
          developer_terms_accepted_at?: string | null
          display_name?: string | null
          facebook_url?: string | null
          follower_count?: number
          github_url?: string | null
          id?: string
          instagram_url?: string | null
          is_developer?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          linkedin_url?: string | null
          location?: string | null
          mode?: string
          phone?: string | null
          phone_verified?: boolean
          portfolio_url?: string | null
          reputation_score?: number
          skills?: string[]
          suspended?: boolean
          updated_at?: string
          website_url?: string | null
          whatsapp_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          budget_mwk: number
          clicks: number
          created_at: string
          ends_at: string | null
          id: string
          impressions: number
          kind: string
          listing_id: string
          name: string | null
          owner_id: string
          spent_mwk: number
          starts_at: string
          status: string
          target_location: string | null
        }
        Insert: {
          budget_mwk?: number
          clicks?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          kind?: string
          listing_id: string
          name?: string | null
          owner_id: string
          spent_mwk?: number
          starts_at?: string
          status?: string
          target_location?: string | null
        }
        Update: {
          budget_mwk?: number
          clicks?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          kind?: string
          listing_id?: string
          name?: string | null
          owner_id?: string
          spent_mwk?: number
          starts_at?: string
          status?: string
          target_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
          developer_reply: string | null
          id: string
          listing_id: string
          rating: number
          replied_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          developer_reply?: string | null
          id?: string
          listing_id: string
          rating: number
          replied_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          developer_reply?: string | null
          id?: string
          listing_id?: string
          rating?: number
          replied_at?: string | null
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
      search_events: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          query?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      security_settings: {
        Row: {
          backup_codes: string[]
          created_at: string
          recovery_email: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[]
          created_at?: string
          recovery_email?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[]
          created_at?: string
          recovery_email?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spotlight_applications: {
        Row: {
          created_at: string
          developer_id: string
          id: string
          listing_id: string | null
          opportunity: string
          pitch: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          developer_id: string
          id?: string
          listing_id?: string | null
          opportunity: string
          pitch?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          developer_id?: string
          id?: string
          listing_id?: string | null
          opportunity?: string
          pitch?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_applications_listing_id_fkey"
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
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          member_id: string | null
          owner_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          member_id?: string | null
          owner_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_id?: string | null
          owner_id?: string
          role?: string
          status?: string
          updated_at?: string
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
      wallet_transactions: {
        Row: {
          amount_mwk: number
          created_at: string
          description: string | null
          id: string
          kind: string
          listing_id: string | null
          method: string | null
          reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_mwk?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          method?: string | null
          reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_mwk?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          method?: string | null
          reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_mwk: number
          created_at: string
          id: string
          lifetime_mwk: number
          pending_mwk: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_mwk?: number
          created_at?: string
          id?: string
          lifetime_mwk?: number
          pending_mwk?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_mwk?: number
          created_at?: string
          id?: string
          lifetime_mwk?: number
          pending_mwk?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      compute_reputation: { Args: { _developer: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: {
        Args: { _owner: string; _user: string }
        Returns: boolean
      }
      register_install: {
        Args: { _country?: string; _device?: string; _listing_id: string }
        Returns: undefined
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
