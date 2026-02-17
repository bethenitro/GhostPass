-- Migration: Allow users to create their own records in the users table
-- This enables automatic user sync from be-valid to ghost-pass

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can create their own record" ON public.users;

-- Create policy to allow authenticated users to insert their own record
CREATE POLICY "Users can create their own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Also allow users to read their own record
DROP POLICY IF EXISTS "Users can read their own record" ON public.users;

CREATE POLICY "Users can read their own record"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow admins to read all users (keep existing admin policies)
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('ADMIN', 'VENUE_ADMIN')
  )
);

COMMENT ON POLICY "Users can create their own record" ON public.users IS 
'Allows authenticated users to create their own user record for cross-database sync';
