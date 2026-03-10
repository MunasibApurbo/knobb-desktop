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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      client_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          level: string
          message: string | null
          payload: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          level?: string
          message?: string | null
          payload?: Json
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          level?: string
          message?: string | null
          payload?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      current_status: {
        Row: {
          artist_name: string | null
          cover_url: string | null
          started_at: string | null
          track_id: string | null
          track_title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          artist_name?: string | null
          cover_url?: string | null
          started_at?: string | null
          track_id?: string | null
          track_title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          artist_name?: string | null
          cover_url?: string | null
          started_at?: string | null
          track_id?: string | null
          track_title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playback_sessions: {
        Row: {
          created_at: string
          current_track_data: Json | null
          device_id: string
          device_name: string
          duration: number
          id: string
          is_playing: boolean
          last_seen_at: string
          position_seconds: number
          quality: string
          queue_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_track_data?: Json | null
          device_id: string
          device_name: string
          duration?: number
          id?: string
          is_playing?: boolean
          last_seen_at?: string
          position_seconds?: number
          quality?: string
          queue_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_track_data?: Json | null
          device_id?: string
          device_name?: string
          duration?: number
          id?: string
          is_playing?: boolean
          last_seen_at?: string
          position_seconds?: number
          quality?: string
          queue_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_artists: {
        Row: {
          artist_id: number
          artist_image_url: string | null
          artist_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          artist_id: number
          artist_image_url?: string | null
          artist_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          artist_id?: number
          artist_image_url?: string | null
          artist_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_playlists: {
        Row: {
          created_at: string
          id: string
          playlist_cover_url: string | null
          playlist_id: string
          playlist_title: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_cover_url?: string | null
          playlist_id: string
          playlist_title: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_cover_url?: string | null
          playlist_id?: string
          playlist_title?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      liked_songs: {
        Row: {
          id: string
          liked_at: string
          track_data: Json
          track_key: string
          track_keyworking: string | null
          user_id: string
        }
        Insert: {
          id?: string
          liked_at?: string
          track_data: Json
          track_key: string
          track_keyworking?: string | null
          user_id: string
        }
        Update: {
          id?: string
          liked_at?: string
          track_data?: Json
          track_key?: string
          track_keyworking?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      play_history: {
        Row: {
          context_id: string | null
          context_type: string | null
          duration_seconds: number
          event_type: string
          id: string
          listened_seconds: number
          played_at: string
          track_data: Json
          track_key: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          duration_seconds?: number
          event_type?: string
          id?: string
          listened_seconds?: number
          played_at?: string
          track_data: Json
          track_key: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          duration_seconds?: number
          event_type?: string
          id?: string
          listened_seconds?: number
          played_at?: string
          track_data?: Json
          track_key?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          playlist_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          track_data: Json
          track_key: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_data: Json
          track_key: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_data?: Json
          track_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          share_token: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          share_token?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          share_token?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          language_preference: string | null
          live_status_visibility: string
          player_preferences: Json
          profile_visibility: string
          ui_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language_preference?: string | null
          live_status_visibility?: string
          player_preferences?: Json
          profile_visibility?: string
          ui_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language_preference?: string | null
          live_status_visibility?: string
          player_preferences?: Json
          profile_visibility?: string
          ui_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_albums: {
        Row: {
          album_artist: string
          album_cover_url: string | null
          album_id: number
          album_title: string
          album_year: number | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          album_artist: string
          album_cover_url?: string | null
          album_id: number
          album_title: string
          album_year?: number | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          album_artist?: string
          album_cover_url?: string | null
          album_id?: number
          album_title?: string
          album_year?: number | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_listening_stats: {
        Row: {
          completed_plays: number | null
          minutes_last_7d: number | null
          plays_last_7d: number | null
          skipped_plays: number | null
          total_minutes: number | null
          total_plays: number | null
          unique_tracks: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_live_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      enqueue_notification: {
        Args: {
          notification_body?: string
          notification_data?: Json
          notification_title: string
          notification_type: string
          target_user_id: string
        }
        Returns: string
      }
      get_playlist_collaborators: {
        Args: { target_playlist_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          role: string
          user_id: string
        }[]
      }
      get_playlist_tracks: {
        Args: { target_playlist_id: string }
        Returns: {
          added_at: string
          position: number
          track_data: Json
        }[]
      }
      get_shared_playlist_by_token: {
        Args: { target_token: string }
        Returns: {
          cover_url: string
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      get_shared_playlist_tracks_by_token: {
        Args: { target_token: string }
        Returns: {
          position: number
          track_data: Json
        }[]
      }
      get_user_playlist_summaries: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_role: string
          cover_url: string
          created_at: string
          description: string
          id: string
          name: string
          share_token: string
          track_count: number
          user_id: string
          visibility: string
        }[]
      }
      invite_playlist_collaborator: {
        Args: {
          target_email: string
          target_playlist_id: string
          target_role?: string
        }
        Returns: string
      }
      log_client_event: {
        Args: {
          event_name_input: string
          level_input: string
          message_input?: string
          payload_input?: Json
          source_input?: string
        }
        Returns: string
      }
      record_play_event: {
        Args: {
          context_id_input?: string
          context_type_input?: string
          listened_seconds_input?: number
          scrobble_percent_input?: number
          target_track_data: Json
        }
        Returns: {
          event_id: string
          event_type: string
          inserted: boolean
        }[]
      }
      track_identity: { Args: { track: Json }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
