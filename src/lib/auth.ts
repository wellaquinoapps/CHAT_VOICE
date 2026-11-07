import { supabase } from './supabase';
import type { Database } from '../types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, displayName: string, role: 'guardian' | 'child' = 'guardian') {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName.trim(),
        role,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
  return true;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateProfile(displayName: string, avatarPath?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado.');

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName.trim(),
      avatar_path: avatarPath,
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

