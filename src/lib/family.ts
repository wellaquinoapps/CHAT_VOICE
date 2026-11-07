import { supabase } from './supabase';
import type { Database } from '../types/database.types';

export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyMember = Database['public']['Tables']['family_members']['Row'] & {
  profile?: Database['public']['Tables']['profiles']['Row'];
};
export type Conversation = Database['public']['Tables']['conversations']['Row'];

export async function getUserFamilyData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Fetch user membership
  const { data: membership, error: memError } = await supabase
    .from('family_members')
    .select('*, family:families(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memError || !membership) {
    return null;
  }

  const familyId = membership.family_id;

  // 2. Fetch all members in family with their profiles
  const { data: rawMembers, error: membersError } = await supabase
    .from('family_members')
    .select('*, profile:profiles(*)')
    .eq('family_id', familyId);

  if (membersError) {
    console.error('Error fetching members:', membersError);
  }

  // 3. Fetch direct conversation for this family (or ensure one exists)
  let { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('family_id', familyId)
    .limit(1);

  let activeConversation = conversations && conversations.length > 0 ? conversations[0] : null;

  // Se não existir conversa direta e já houver mais de um membro (responsável e filho), cria automaticamente
  if (!activeConversation && rawMembers && rawMembers.length >= 2) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ family_id: familyId, conversation_type: 'direct' })
      .select('*')
      .single();

    if (newConv) {
      activeConversation = newConv;
      const memberInserts = rawMembers.map(m => ({
        conversation_id: newConv.id,
        user_id: m.user_id,
      }));
      await supabase.from('conversation_members').upsert(memberInserts);
    }
  }

  return {
    family: membership.family as unknown as Family,
    currentMember: membership as FamilyMember,
    members: (rawMembers || []) as FamilyMember[],
    conversation: activeConversation,
  };
}

export async function createFamily(familyName: string) {
  const { data, error } = await supabase.rpc('create_family_with_guardian', {
    p_family_name: familyName.trim(),
  });

  if (error) throw error;
  return data;
}

export async function generateInvite(familyId: string, expiresInHours: number = 24) {
  const { data, error } = await supabase.rpc('generate_family_invite', {
    p_family_id: familyId,
    p_expires_in_hours: expiresInHours,
  });

  if (error) throw error;
  return data as {
    invite_id: string;
    family_id: string;
    token: string;
    expires_at: string;
  };
}

export async function redeemInvite(token: string) {
  const { data, error } = await supabase.rpc('redeem_family_invite', {
    p_token: token.trim(),
  });

  if (error) throw error;
  return data as {
    success: boolean;
    family_id: string;
    family_name: string;
    guardian_id: string;
    conversation_id: string;
  };
}

export async function setChildMemberStatus(familyId: string, childUserId: string, status: 'active' | 'disabled') {
  const { data, error } = await supabase
    .from('family_members')
    .update({ status })
    .eq('family_id', familyId)
    .eq('user_id', childUserId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserDevices(userId?: string) {
  let query = supabase.from('user_devices').select('*').order('last_seen_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
  return data;
}

export async function revokeDevice(deviceId: string) {
  const { error } = await supabase.from('user_devices').delete().eq('id', deviceId);
  if (error) throw error;
  return true;
}

