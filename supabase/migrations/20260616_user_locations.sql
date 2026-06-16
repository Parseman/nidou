-- Table pour stocker la position géographique de chaque utilisateur
CREATE TABLE IF NOT EXISTS user_locations (
  user_id     text        PRIMARY KEY,
  lat         float8      NOT NULL,
  lng         float8      NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Les deux partenaires peuvent lire la position de l'autre
CREATE POLICY "authenticated can read locations"
  ON user_locations FOR SELECT TO authenticated USING (true);

-- Chaque user gère uniquement sa propre ligne
CREATE POLICY "user can insert own location"
  ON user_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user can update own location"
  ON user_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

-- Activer Realtime pour que chaque partenaire voie la position de l'autre en temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE user_locations;
