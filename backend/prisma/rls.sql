-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- Enable RLS on all tables and create user isolation policies
-- Run this in Supabase SQL Editor after migration
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Draft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboundEmail" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER TABLE POLICIES
-- Users can only read/update their own record
-- =====================================================

CREATE POLICY "Users can view their own user data"
ON "User"
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own user data"
ON "User"
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Users cannot delete their own record (admin only)
-- No DELETE policy means no deletion via API

-- =====================================================
-- LEAD TABLE POLICIES
-- Users can only access leads they own
-- =====================================================

CREATE POLICY "Users can view their own leads"
ON "Lead"
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert leads"
ON "Lead"
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own leads"
ON "Lead"
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own leads"
ON "Lead"
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- CAMPAIGN TABLE POLICIES
-- Users can only access campaigns they own
-- =====================================================

CREATE POLICY "Users can view their own campaigns"
ON "Campaign"
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert campaigns"
ON "Campaign"
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own campaigns"
ON "Campaign"
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns"
ON "Campaign"
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- DRAFT TABLE POLICIES
-- Users can only access drafts they own
-- =====================================================

CREATE POLICY "Users can view their own drafts"
ON "Draft"
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert drafts"
ON "Draft"
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own drafts"
ON "Draft"
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own drafts"
ON "Draft"
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- OUTBOUND EMAIL TABLE POLICIES
-- Users can only access emails they own
-- =====================================================

CREATE POLICY "Users can view their own outbound emails"
ON "OutboundEmail"
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert outbound emails"
ON "OutboundEmail"
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own outbound emails"
ON "OutboundEmail"
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own outbound emails"
ON "OutboundEmail"
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- OPTIONAL: Auto-enable RLS for future tables
-- Creates an event trigger that automatically enables RLS on new tables
-- =====================================================

CREATE OR REPLACE FUNCTION auto_enable_rls()
RETURNS EVENT_TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN 
    SELECT * FROM pg_event_trigger_ddl_commands() 
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF obj.schema_name = 'public' THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', obj.schema_name, obj.object_name);
        RAISE LOG 'Auto-enabled RLS on %.%', obj.schema_name, obj.object_name;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Failed to enable RLS on %.%: %', obj.schema_name, obj.object_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- Drop existing trigger if any
DROP EVENT TRIGGER IF EXISTS ensure_rls_on_new_tables;

-- Create new trigger
CREATE EVENT TRIGGER ensure_rls_on_new_tables
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION auto_enable_rls();

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to confirm policies are active
-- =====================================================

-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check which tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;