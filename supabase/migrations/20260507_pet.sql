-- Table du chat Tamagotchi partagé (une seule ligne, id=1)
CREATE TABLE IF NOT EXISTS pet (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  hunger        INTEGER NOT NULL DEFAULT 100,   -- 0-100, diminue avec le temps
  hygiene       INTEGER NOT NULL DEFAULT 100,
  happiness     INTEGER NOT NULL DEFAULT 100,
  last_fed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_washed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_pet_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_pet CHECK (id = 1)
);

INSERT INTO pet (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE pet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can access pet"
  ON pet FOR ALL TO authenticated USING (true) WITH CHECK (true);
