-- Table pour stocker le trajet (départ/arrivée) propre à chaque utilisateur
CREATE TABLE IF NOT EXISTS user_trips (
  user_id         text        PRIMARY KEY,
  user_name       text,
  departure_date  text        NOT NULL,
  arrival_date    text        NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_trips ENABLE ROW LEVEL SECURITY;

-- Les deux partenaires peuvent lire le trajet de l'autre (barre de progression navbar)
CREATE POLICY "authenticated can read trips"
  ON user_trips FOR SELECT TO authenticated USING (true);

-- Chaque user gère uniquement son propre trajet
CREATE POLICY "user can insert own trip"
  ON user_trips FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user can update own trip"
  ON user_trips FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

-- Activer Realtime pour que chaque partenaire voie l'avancée de l'autre en temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE user_trips;
