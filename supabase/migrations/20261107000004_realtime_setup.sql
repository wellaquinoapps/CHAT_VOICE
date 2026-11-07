-- ==============================================================================
-- MIGRATION: 20261107000004_realtime_setup.sql
-- DESCRIPTION: Supabase Realtime publication configuration for messages, calls and signaling.
-- AUTHOR: Antigravity Team
-- CREATED: 2026-11-07
-- ==============================================================================

-- Configure replica identity to FULL for proper payload delivery in Realtime updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;

-- Add relevant tables to the supabase_realtime publication
DO $$
BEGIN
    -- Check if supabase_realtime publication exists
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Add messages table if not present
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        END IF;

        -- Add calls table if not present
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'calls'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
        END IF;

        -- Add call_signals table if not present
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_signals'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
        END IF;
    END IF;
END $$;

