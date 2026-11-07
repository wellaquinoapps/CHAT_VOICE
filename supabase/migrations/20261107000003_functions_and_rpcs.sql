-- ==============================================================================
-- MIGRATION: 20261107000003_functions_and_rpcs.sql
-- DESCRIPTION: Atomic stored procedures and RPCs for family invitations and cleanup.
-- AUTHOR: Antigravity Team
-- CREATED: 2026-11-07
-- ==============================================================================

-- ==============================================================================
-- 1. RPC: create_family_with_guardian
-- Creates family and binds the creating guardian atomically.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_family_with_guardian(p_family_name TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_family_id UUID;
    v_role public.user_role;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
    END IF;

    -- Ensure caller has guardian role
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role <> 'guardian' THEN
        RAISE EXCEPTION 'Apenas responsáveis podem criar famílias.' USING ERRCODE = '42501';
    END IF;

    IF char_length(trim(p_family_name)) < 2 OR char_length(p_family_name) > 80 THEN
        RAISE EXCEPTION 'Nome da família inválido (entre 2 e 80 caracteres).' USING ERRCODE = '22023';
    END IF;

    -- Insert family
    INSERT INTO public.families (name, created_by)
    VALUES (trim(p_family_name), v_user_id)
    RETURNING id INTO v_family_id;

    -- Insert membership as guardian
    INSERT INTO public.family_members (family_id, user_id, member_role, status)
    VALUES (v_family_id, v_user_id, 'guardian', 'active');

    RETURN jsonb_build_object(
        'family_id', v_family_id,
        'name', trim(p_family_name)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 2. RPC: generate_family_invite
-- Generates a single-use high-entropy token, stores its SHA-256 hash, and returns
-- the plain token once to the guardian.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.generate_family_invite(
    p_family_id UUID,
    p_expires_in_hours INTEGER DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token TEXT;
    v_token_hash TEXT;
    v_invite_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
    END IF;

    -- Validate caller is active guardian of this family
    IF NOT public.is_active_guardian(v_user_id, p_family_id) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas o responsável da família pode gerar convites.' USING ERRCODE = '42501';
    END IF;

    IF p_expires_in_hours < 1 OR p_expires_in_hours > 168 THEN
        RAISE EXCEPTION 'A validade do convite deve ser entre 1 e 168 horas (7 dias).' USING ERRCODE = '22023';
    END IF;

    -- Generate 32 bytes of secure random entropy (64 hex characters)
    v_token := encode(gen_random_bytes(32), 'hex');
    -- Compute SHA-256 hash of token for storage
    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
    v_expires_at := timezone('utc'::text, now()) + (p_expires_in_hours || ' hours')::interval;

    INSERT INTO public.family_invites (
        family_id,
        token_hash,
        expires_at,
        created_by
    )
    VALUES (
        p_family_id,
        v_token_hash,
        v_expires_at,
        v_user_id
    )
    RETURNING id INTO v_invite_id;

    RETURN jsonb_build_object(
        'invite_id', v_invite_id,
        'family_id', p_family_id,
        'token', v_token,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 3. RPC: redeem_family_invite
-- Child validates single-use token and binds atomically to family.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.redeem_family_invite(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token_hash TEXT;
    v_invite RECORD;
    v_family RECORD;
    v_conv_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
    END IF;

    IF p_token IS NULL OR char_length(trim(p_token)) < 16 THEN
        RAISE EXCEPTION 'Código de convite inválido.' USING ERRCODE = '22023';
    END IF;

    -- Calculate SHA-256 of candidate token
    v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

    -- Find matching active invite with row-level lock
    SELECT * INTO v_invite
    FROM public.family_invites
    WHERE token_hash = v_token_hash
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Convite não encontrado ou inválido.' USING ERRCODE = 'P0002';
    END IF;

    IF v_invite.used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Este convite já foi utilizado.' USING ERRCODE = '23505';
    END IF;

    IF v_invite.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Este convite expirou.' USING ERRCODE = '22008';
    END IF;

    -- Fetch family details
    SELECT * INTO v_family
    FROM public.families
    WHERE id = v_invite.family_id;

    -- Set user role to 'child'
    UPDATE public.profiles
    SET role = 'child', updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;

    -- Add child as active family member
    INSERT INTO public.family_members (
        family_id,
        user_id,
        member_role,
        status
    )
    VALUES (
        v_invite.family_id,
        v_user_id,
        'child',
        'active'
    )
    ON CONFLICT (family_id, user_id)
    DO UPDATE SET status = 'active', member_role = 'child';

    -- Mark invite as used
    UPDATE public.family_invites
    SET used_at = timezone('utc'::text, now())
    WHERE id = v_invite.id;

    -- Look for existing direct conversation between guardian and child in this family
    SELECT c.id INTO v_conv_id
    FROM public.conversations c
    WHERE c.family_id = v_invite.family_id
      AND c.conversation_type = 'direct'
      AND EXISTS (SELECT 1 FROM public.conversation_members cm1 WHERE cm1.conversation_id = c.id AND cm1.user_id = v_user_id)
      AND EXISTS (SELECT 1 FROM public.conversation_members cm2 WHERE cm2.conversation_id = c.id AND cm2.user_id = v_invite.created_by)
    LIMIT 1;

    -- If none exists, create direct conversation
    IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (family_id, conversation_type)
        VALUES (v_invite.family_id, 'direct')
        RETURNING id INTO v_conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES 
            (v_conv_id, v_user_id),
            (v_conv_id, v_invite.created_by);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'family_id', v_invite.family_id,
        'family_name', v_family.name,
        'guardian_id', v_invite.created_by,
        'conversation_id', v_conv_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 4. HOUSEKEEPING: cleanup_stale_signals_and_calls
-- Purges old WebRTC signals and marks hanging calls as missed.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_signals_and_calls()
RETURNS JSONB AS $$
DECLARE
    v_signals_deleted INTEGER;
    v_calls_timed_out INTEGER;
BEGIN
    -- Delete signals older than 2 hours (WebRTC signaling is ephemeral)
    DELETE FROM public.call_signals
    WHERE created_at < timezone('utc'::text, now()) - interval '2 hours';
    GET DIAGNOSTICS v_signals_deleted = ROW_COUNT;

    -- Mark calls ringing for more than 5 minutes as missed
    UPDATE public.calls
    SET status = 'missed', ended_at = timezone('utc'::text, now())
    WHERE status = 'ringing'
      AND started_at < timezone('utc'::text, now()) - interval '5 minutes';
    GET DIAGNOSTICS v_calls_timed_out = ROW_COUNT;

    RETURN jsonb_build_object(
        'signals_deleted', v_signals_deleted,
        'calls_timed_out', v_calls_timed_out
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

