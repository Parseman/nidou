ALTER TABLE couple_settings
  ADD COLUMN IF NOT EXISTS coins          integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_coin_update_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS coin_rate      integer      NOT NULL DEFAULT 0;

-- Activer Realtime sur couple_settings (nécessaire pour le pot commun live)
ALTER PUBLICATION supabase_realtime ADD TABLE couple_settings;
