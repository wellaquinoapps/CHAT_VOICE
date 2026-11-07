-- ==============================================================================
-- MIGRATION: 20261107000005_register_child_function.sql
-- DESCRIPTION: SQL function to allow guardian to register a child directly.
--              Used as fallback when Edge Function is not available.
-- ==============================================================================

-- RPC: register_child_directly
-- Called only by guardians via service-role Edge Function (register-child).
-- Creates profile + family_member + conversation in one atomic transaction.
CREATE OR REPLACE FUNCTION public.register_child_directly(
    p_guardian_id UUID,
    p_child_id UUID,
    p_family_id UUID,
    p_child_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_conv_id UUID;
BEGIN
    -- Validate guardian is active in the family
    IF NOT public.is_active_guardian(p_guardian_id, p_family_id) THEN
        RAISE EXCEPTION 'Acesso negado: apenas responsáveis podem registrar filhos.' USING ERRCODE = '42501';
    END IF;

    -- Upsert child profile with role child
    INSERT INTO public.profiles (id, display_name, role)
    VALUES (p_child_id, trim(p_child_name), 'child')
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = 'child',
        updated_at = timezone('utc'::text, now());

    -- Add child to family
    INSERT INTO public.family_members (family_id, user_id, member_role, status)
    VALUES (p_family_id, p_child_id, 'child', 'active')
    ON CONFLICT (family_id, user_id) DO UPDATE SET
        status = 'active',
        member_role = 'child';

    -- Create or find the direct conversation
    SELECT c.id INTO v_conv_id
    FROM public.conversations c
    WHERE c.family_id = p_family_id
      AND c.conversation_type = 'direct'
      AND EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = p_guardian_id)
      AND EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = p_child_id)
    LIMIT 1;

    IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (family_id, conversation_type)
        VALUES (p_family_id, 'direct')
        RETURNING id INTO v_conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES
            (v_conv_id, p_guardian_id),
            (v_conv_id, p_child_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'child_id', p_child_id,
        'conversation_id', v_conv_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.register_child_directly(UUID, UUID, UUID, TEXT) TO service_role;

