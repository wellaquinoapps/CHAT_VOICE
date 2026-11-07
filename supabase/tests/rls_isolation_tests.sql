-- ==============================================================================
-- TEST SUITE: rls_isolation_tests.sql
-- DESCRIPTION: Automated SQL tests verifying family isolation and RLS security boundaries.
-- AUTHOR: Antigravity Team
-- ==============================================================================

BEGIN;

-- Create test helper output table
CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    details TEXT
);

-- ==============================================================================
-- 1. SETUP TEST FIXTURES
-- ==============================================================================
DO $$
DECLARE
    u_guardian_a UUID := '11111111-1111-1111-1111-111111111111';
    u_child_a UUID    := '22222222-2222-2222-2222-222222222222';
    u_guardian_b UUID := '33333333-3333-3333-3333-333333333333';
    u_child_b UUID    := '44444444-4444-4444-4444-444444444444';
    u_stranger UUID   := '99999999-9999-9999-9999-999999999999';

    fam_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    fam_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    conv_a UUID := 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    conv_b UUID := 'cbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Mock profiles in public.profiles
    INSERT INTO public.profiles (id, display_name, role) VALUES
        (u_guardian_a, 'Pai Família A', 'guardian'),
        (u_child_a, 'Filho Família A', 'child'),
        (u_guardian_b, 'Mãe Família B', 'guardian'),
        (u_child_b, 'Filho Família B', 'child'),
        (u_stranger, 'Estranho Não Vinculado', 'guardian')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

    -- Create Families
    INSERT INTO public.families (id, name, created_by) VALUES
        (fam_a, 'Família Silva', u_guardian_a),
        (fam_b, 'Família Souza', u_guardian_b)
    ON CONFLICT (id) DO NOTHING;

    -- Family Memberships
    INSERT INTO public.family_members (family_id, user_id, member_role, status) VALUES
        (fam_a, u_guardian_a, 'guardian', 'active'),
        (fam_a, u_child_a, 'child', 'active'),
        (fam_b, u_guardian_b, 'guardian', 'active'),
        (fam_b, u_child_b, 'child', 'active')
    ON CONFLICT (family_id, user_id) DO NOTHING;

    -- Conversations
    INSERT INTO public.conversations (id, family_id, conversation_type) VALUES
        (conv_a, fam_a, 'direct'),
        (conv_b, fam_b, 'direct')
    ON CONFLICT (id) DO NOTHING;

    -- Conversation Members
    INSERT INTO public.conversation_members (conversation_id, user_id) VALUES
        (conv_a, u_guardian_a),
        (conv_a, u_child_a),
        (conv_b, u_guardian_b),
        (conv_b, u_child_b)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- Messages
    INSERT INTO public.messages (id, conversation_id, sender_id, body) VALUES
        ('11111111-0000-0000-0000-000000000001', conv_a, u_guardian_a, 'Mensagem secreta Família A'),
        ('22222222-0000-0000-0000-000000000002', conv_b, u_guardian_b, 'Mensagem secreta Família B')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ==============================================================================
-- TEST 1: Guardian A CANNOT see Family B's messages
-- ==============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Set auth context to Guardian A
    PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO v_count
    FROM public.messages
    WHERE body = 'Mensagem secreta Família B';

    IF v_count = 0 THEN
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Isolation: Guardian A cannot read Family B messages', true, 'Blocked as expected.');
    ELSE
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Isolation: Guardian A cannot read Family B messages', false, 'LEAK DETECTED!');
    END IF;
END $$;

-- ==============================================================================
-- TEST 2: Stranger cannot see any family messages
-- ==============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Set auth context to stranger
    PERFORM set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO v_count FROM public.messages;

    IF v_count = 0 THEN
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Isolation: Unaffiliated user cannot read any messages', true, 'Returned 0 rows as expected.');
    ELSE
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Isolation: Unaffiliated user cannot read any messages', false, 'Stranger could read messages!');
    END IF;
END $$;

-- ==============================================================================
-- TEST 3: User cannot spoof sender_id in messages
-- ==============================================================================
DO $$
DECLARE
    v_error_caught BOOLEAN := false;
BEGIN
    -- Set auth context to Child A
    PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        -- Attempt to insert message pretending to be Guardian A
        INSERT INTO public.messages (conversation_id, sender_id, body)
        VALUES ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Spoofed sender message');
    EXCEPTION
        WHEN OTHERS THEN
            v_error_caught := true;
    END;

    IF v_error_caught THEN
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Integrity: User cannot spoof sender_id', true, 'Insertion rejected by RLS WITH CHECK.');
    ELSE
        INSERT INTO test_results (name, passed, details)
        VALUES ('RLS Integrity: User cannot spoof sender_id', false, 'Spoofed message allowed!');
    END IF;
END $$;

-- ==============================================================================
-- TEST 4: Child account cannot escalate own role to guardian
-- ==============================================================================
DO $$
DECLARE
    v_role public.user_role;
BEGIN
    -- Set auth context to Child A
    PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
    PERFORM set_config('role', 'authenticated', true);

    -- Try updating role
    UPDATE public.profiles
    SET role = 'guardian'
    WHERE id = '22222222-2222-2222-2222-222222222222';

    -- Reset to check value in superuser mode
    PERFORM set_config('role', 'postgres', true);
    SELECT role INTO v_role FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222';

    IF v_role = 'child' THEN
        INSERT INTO test_results (name, passed, details)
        VALUES ('Privilege Escalation: Child cannot change role to guardian', true, 'Role remained child.');
    ELSE
        INSERT INTO test_results (name, passed, details)
        VALUES ('Privilege Escalation: Child cannot change role to guardian', false, 'Escalation succeeded!');
    END IF;
END $$;

-- ==============================================================================
-- TEST 5: Child cannot view or create family invites
-- ==============================================================================
DO $$
DECLARE
    v_invites_count INTEGER;
    v_insert_failed BOOLEAN := false;
BEGIN
    -- Set auth context to Child A
    PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO v_invites_count FROM public.family_invites;

    BEGIN
        INSERT INTO public.family_invites (family_id, token_hash, expires_at, created_by)
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fakehash', now() + interval '1 day', '22222222-2222-2222-2222-222222222222');
    EXCEPTION
        WHEN OTHERS THEN
            v_insert_failed := true;
    END;

    IF v_invites_count = 0 AND v_insert_failed THEN
        INSERT INTO test_results (name, passed, details)
        VALUES ('Invite Protection: Child cannot view or create family invites', true, 'Zero rows read and insert blocked.');
    ELSE
        INSERT INTO test_results (name, passed, details)
        VALUES ('Invite Protection: Child cannot view or create family invites', false, 'Child accessed invites table!');
    END IF;
END $$;

-- Display results
PERFORM set_config('role', 'postgres', true);
SELECT * FROM test_results;

ROLLBACK;

