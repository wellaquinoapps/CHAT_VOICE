// ==============================================================================
// FILE: supabase/functions/_shared/supabaseClient.ts
// DESCRIPTION: Supabase client helper factories for user context and admin context.
// ==============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export function getSupabaseUserClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Header de autorização ausente.');
  }

  const supabase = getSupabaseUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Usuário não autenticado ou token expirado.');
  }

  return { user, supabase };
}

