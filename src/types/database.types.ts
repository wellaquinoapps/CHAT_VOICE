// ==============================================================================
// FILE: src/types/database.types.ts
// DESCRIPTION: Strictly typed Supabase database schema definitions.
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'guardian' | 'child';
export type MemberStatus = 'active' | 'disabled';
export type ConversationType = 'direct';
export type MessageType = 'text';
export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'cancelled';
export type SignalType = 'offer' | 'answer' | 'ice-candidate';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_path: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_path?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_path?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      families: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'families_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          member_role: UserRole;
          status: MemberStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id: string;
          member_role: UserRole;
          status?: MemberStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          user_id?: string;
          member_role?: UserRole;
          status?: MemberStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_members_family_id_fkey';
            columns: ['family_id'];
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      family_invites: {
        Row: {
          id: string;
          family_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_invites_family_id_fkey';
            columns: ['family_id'];
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_invites_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      conversations: {
        Row: {
          id: string;
          family_id: string;
          conversation_type: ConversationType;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          conversation_type?: ConversationType;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          conversation_type?: ConversationType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_family_id_fkey';
            columns: ['family_id'];
            referencedRelation: 'families';
            referencedColumns: ['id'];
          }
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type: MessageType;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          message_type?: MessageType;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      calls: {
        Row: {
          id: string;
          family_id: string;
          conversation_id: string;
          initiated_by: string;
          call_type: CallType;
          status: CallStatus;
          started_at: string;
          answered_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          conversation_id: string;
          initiated_by: string;
          call_type: CallType;
          status?: CallStatus;
          started_at?: string;
          answered_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          conversation_id?: string;
          initiated_by?: string;
          call_type?: CallType;
          status?: CallStatus;
          started_at?: string;
          answered_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calls_family_id_fkey';
            columns: ['family_id'];
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calls_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calls_initiated_by_fkey';
            columns: ['initiated_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      call_signals: {
        Row: {
          id: string;
          call_id: string;
          sender_id: string;
          receiver_id: string;
          signal_type: SignalType;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_id: string;
          sender_id: string;
          receiver_id: string;
          signal_type: SignalType;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          call_id?: string;
          sender_id?: string;
          receiver_id?: string;
          signal_type?: SignalType;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'call_signals_call_id_fkey';
            columns: ['call_id'];
            referencedRelation: 'calls';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_signals_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_signals_receiver_id_fkey';
            columns: ['receiver_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          device_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      user_devices: {
        Row: {
          id: string;
          user_id: string;
          device_label: string;
          user_agent: string | null;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_label: string;
          user_agent?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_label?: string;
          user_agent?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_devices_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_family_with_guardian: {
        Args: {
          p_family_name: string;
        };
        Returns: {
          family_id: string;
          name: string;
        };
      };
      generate_family_invite: {
        Args: {
          p_family_id: string;
          p_expires_in_hours?: number;
        };
        Returns: {
          invite_id: string;
          family_id: string;
          token: string;
          expires_at: string;
        };
      };
      redeem_family_invite: {
        Args: {
          p_token: string;
        };
        Returns: {
          success: boolean;
          family_id: string;
          family_name: string;
          guardian_id: string;
          conversation_id: string;
        };
      };
      cleanup_stale_signals_and_calls: {
        Args: Record<PropertyKey, never>;
        Returns: {
          signals_deleted: number;
          calls_timed_out: number;
        };
      };
      is_active_family_member: {
        Args: {
          p_user_id: string;
          p_family_id: string;
        };
        Returns: boolean;
      };
      is_active_guardian: {
        Args: {
          p_user_id: string;
          p_family_id: string;
        };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: {
          p_user_id: string;
          p_conversation_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      member_status: MemberStatus;
      conversation_type: ConversationType;
      message_type: MessageType;
      call_type: CallType;
      call_status: CallStatus;
      signal_type: SignalType;
    };
  };
}

