
DROP POLICY IF EXISTS "admin write decideurs" ON veille.decideurs;
CREATE POLICY "admin write decideurs" ON veille.decideurs
FOR ALL TO authenticated
USING (veille.is_admin())
WITH CHECK (veille.is_admin());

DROP POLICY IF EXISTS "admin write entreprises" ON veille.entreprises;
CREATE POLICY "admin write entreprises" ON veille.entreprises
FOR ALL TO authenticated
USING (veille.is_admin())
WITH CHECK (veille.is_admin());
