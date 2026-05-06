-- Table partagée pour les paramètres du couple (une seule ligne, id=1)
CREATE TABLE IF NOT EXISTS couple_settings (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  next_meeting_date TEXT,
  last_meeting_date TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Ligne par défaut
INSERT INTO couple_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS : seuls les utilisateurs connectés peuvent lire et écrire
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read"
  ON couple_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can upsert"
  ON couple_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
