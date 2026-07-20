
CREATE OR REPLACE FUNCTION veille.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = veille, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM veille.profiles WHERE id = auth.uid() AND role = 'admin'::veille.profile_role
  );
$$;

DROP POLICY IF EXISTS "admin manage profiles" ON veille.profiles;

CREATE POLICY "admin manage profiles" ON veille.profiles
FOR ALL
TO authenticated
USING (veille.is_admin())
WITH CHECK (veille.is_admin());
