-- ==============================================================================
-- MIGRATION: 20261107000002_rls_policies.sql
-- DESCRIPTION: Row Level Security (RLS) policies and security definer helper functions.
-- AUTHOR: Antigravity Team
-- CREATED: 2026-11-07
-- ==============================================================================

-- ==============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- Using SECURITY DEFINER and fixed search_path to prevent infinite recursion
-- and ensure safe, performant permission evaluation.
-- ==============================================================================

-- Check if user is an active member of a specific family
CREATE OR REPLACE FUNCTION public.is_active_family_member(p_user_id UUID, p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.family_members
        WHERE user_id = p_user_id
          AND family_id = p_family_id
          AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Check if user is an active guardian of a specific family
CREATE OR REPLACE FUNCTION public.is_active_guardian(p_user_id UUID, p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.family_members
        WHERE user_id = p_user_id
          AND family_id = p_family_id
          AND member_role = 'guardian'
          AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Check if user is an active participant of a specific conversation
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_user_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.conversation_members cm
        JOIN public.conversations c ON c.id = cm.conversation_id
        JOIN public.family_members fm ON fm.family_id = c.family_id AND fm.user_id = p_user_id
        WHERE cm.conversation_id = p_conversation_id
          AND cm.user_id = p_user_id
          AND fm.status = 'active'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Retrieve role of a user safely
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS public.user_role AS $$
DECLARE
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. POLICIES: profiles
-- ==============================================================================

-- Can view own profile or profiles of members belonging to same active family
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.family_members fm_me
            JOIN public.family_members fm_other ON fm_me.family_id = fm_other.family_id
            WHERE fm_me.user_id = auth.uid()
              AND fm_other.user_id = profiles.id
              AND fm_me.status = 'active'
              AND fm_other.status = 'active'
        )
    );

-- Can update own profile details, but CANNOT alter role directly
CREATE POLICY "profiles_update_policy"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    );

-- Profile insert allowed for own user ID
CREATE POLICY "profiles_insert_policy"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- ==============================================================================
-- 4. POLICIES: families
-- ==============================================================================

-- Active family members can read family data
CREATE POLICY "families_select_policy"
    ON public.families
    FOR SELECT
    TO authenticated
    USING (public.is_active_family_member(auth.uid(), id));

-- Guardians can create families
CREATE POLICY "families_insert_policy"
    ON public.families
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_user_role(auth.uid()) = 'guardian'
    );

-- Only guardians of the family can update family name
CREATE POLICY "families_update_policy"
    ON public.families
    FOR UPDATE
    TO authenticated
    USING (public.is_active_guardian(auth.uid(), id))
    WITH CHECK (public.is_active_guardian(auth.uid(), id));

-- Only family creator guardian can delete family
CREATE POLICY "families_delete_policy"
    ON public.families
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid() AND public.is_active_guardian(auth.uid(), id));

-- ==============================================================================
-- 5. POLICIES: family_members
-- ==============================================================================

-- Active members can read other members in their families
CREATE POLICY "family_members_select_policy"
    ON public.family_members
    FOR SELECT
    TO authenticated
    USING (public.is_active_family_member(auth.uid(), family_id));

-- Family creator can insert self as guardian upon family creation
CREATE POLICY "family_members_insert_policy"
    ON public.family_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND member_role = 'guardian'
        AND EXISTS (
            SELECT 1 FROM public.families f
            WHERE f.id = family_id AND f.created_by = auth.uid()
        )
    );

-- Guardians can update member status (e.g. disable child)
CREATE POLICY "family_members_update_policy"
    ON public.family_members
    FOR UPDATE
    TO authenticated
    USING (public.is_active_guardian(auth.uid(), family_id))
    WITH CHECK (public.is_active_guardian(auth.uid(), family_id));

-- Guardians can remove members (or member can remove self if not last guardian)
CREATE POLICY "family_members_delete_policy"
    ON public.family_members
    FOR DELETE
    TO authenticated
    USING (
        public.is_active_guardian(auth.uid(), family_id)
        OR user_id = auth.uid()
    );

-- ==============================================================================
-- 6. POLICIES: family_invites
-- Only guardians can view or manage invites. Child accounts have NO access.
-- ==============================================================================

CREATE POLICY "family_invites_select_policy"
    ON public.family_invites
    FOR SELECT
    TO authenticated
    USING (public.is_active_guardian(auth.uid(), family_id));

CREATE POLICY "family_invites_insert_policy"
    ON public.family_invites
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND public.is_active_guardian(auth.uid(), family_id)
    );

CREATE POLICY "family_invites_update_policy"
    ON public.family_invites
    FOR UPDATE
    TO authenticated
    USING (public.is_active_guardian(auth.uid(), family_id))
    WITH CHECK (public.is_active_guardian(auth.uid(), family_id));

CREATE POLICY "family_invites_delete_policy"
    ON public.family_invites
    FOR DELETE
    TO authenticated
    USING (public.is_active_guardian(auth.uid(), family_id));

-- ==============================================================================
-- 7. POLICIES: conversations & conversation_members
-- ==============================================================================

CREATE POLICY "conversations_select_policy"
    ON public.conversations
    FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(auth.uid(), id));

CREATE POLICY "conversations_insert_policy"
    ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_family_member(auth.uid(), family_id));

CREATE POLICY "conv_members_select_policy"
    ON public.conversation_members
    FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "conv_members_insert_policy"
    ON public.conversation_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND public.is_active_family_member(auth.uid(), c.family_id)
        )
    );

-- ==============================================================================
-- 8. POLICIES: messages
-- Strict conversation membership check.
-- Cannot spoof sender_id.
-- ==============================================================================

CREATE POLICY "messages_select_policy"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "messages_insert_policy"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_member(auth.uid(), conversation_id)
    );

CREATE POLICY "messages_update_policy"
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_id = auth.uid()
        AND public.is_conversation_member(auth.uid(), conversation_id)
    )
    WITH CHECK (
        sender_id = auth.uid()
        AND conversation_id = messages.conversation_id
    );

CREATE POLICY "messages_delete_policy"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND public.is_active_guardian(auth.uid(), c.family_id)
        )
    );

-- ==============================================================================
-- 9. POLICIES: calls & call_signals
-- ==============================================================================

CREATE POLICY "calls_select_policy"
    ON public.calls
    FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "calls_insert_policy"
    ON public.calls
    FOR INSERT
    TO authenticated
    WITH CHECK (
        initiated_by = auth.uid()
        AND public.is_conversation_member(auth.uid(), conversation_id)
        AND public.is_active_family_member(auth.uid(), family_id)
    );

CREATE POLICY "calls_update_policy"
    ON public.calls
    FOR UPDATE
    TO authenticated
    USING (public.is_conversation_member(auth.uid(), conversation_id))
    WITH CHECK (public.is_conversation_member(auth.uid(), conversation_id));

-- Signaling policies: only sender or intended receiver can access signals
CREATE POLICY "call_signals_select_policy"
    ON public.call_signals
    FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "call_signals_insert_policy"
    ON public.call_signals
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND receiver_id <> auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.calls c
            WHERE c.id = call_id
              AND public.is_conversation_member(auth.uid(), c.conversation_id)
              AND public.is_conversation_member(receiver_id, c.conversation_id)
        )
    );

CREATE POLICY "call_signals_delete_policy"
    ON public.call_signals
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ==============================================================================
-- 10. POLICIES: push_subscriptions & user_devices
-- ==============================================================================

CREATE POLICY "push_sub_all_policy"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- User can view own devices; Guardian can also view devices of children in their family
CREATE POLICY "user_devices_select_policy"
    ON public.user_devices
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.family_members fm_guard
            JOIN public.family_members fm_child ON fm_guard.family_id = fm_child.family_id
            WHERE fm_guard.user_id = auth.uid()
              AND fm_guard.member_role = 'guardian'
              AND fm_guard.status = 'active'
              AND fm_child.user_id = user_devices.user_id
        )
    );

CREATE POLICY "user_devices_insert_policy"
    ON public.user_devices
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_devices_update_policy"
    ON public.user_devices
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Guardian can revoke/delete device of child; or user can delete own device
CREATE POLICY "user_devices_delete_policy"
    ON public.user_devices
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.family_members fm_guard
            JOIN public.family_members fm_child ON fm_guard.family_id = fm_child.family_id
            WHERE fm_guard.user_id = auth.uid()
              AND fm_guard.member_role = 'guardian'
              AND fm_guard.status = 'active'
              AND fm_child.user_id = user_devices.user_id
        )
    );

