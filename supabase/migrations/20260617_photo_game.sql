-- Table principale du jeu Photo Duel
CREATE TABLE IF NOT EXISTS photo_game (
  id              integer     PRIMARY KEY,
  theme_index     integer     NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  photo_1_url     text,
  photo_1_user_id text,
  photo_2_url     text,
  photo_2_user_id text,
  -- vote_1 = vote SUR la photo_1, posé par l'uploader de photo_2
  -- vote_2 = vote SUR la photo_2, posé par l'uploader de photo_1
  vote_1          boolean,
  vote_2          boolean,
  status          text        NOT NULL DEFAULT 'active', -- active | voting | done
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Ligne unique initiale
INSERT INTO photo_game (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE photo_game ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read photo_game"
  ON photo_game FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can update photo_game"
  ON photo_game FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE photo_game;

-- RPC atomique pour passer au thème suivant (évite la double-avance)
CREATE OR REPLACE FUNCTION advance_photo_game()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status     text;
  v_started_at timestamptz;
BEGIN
  SELECT status, started_at INTO v_status, v_started_at
  FROM photo_game WHERE id = 1 FOR UPDATE;

  -- N'avance que si : done OU (active ET expiré depuis 3 jours)
  IF NOT (
    v_status = 'done'
    OR (v_status = 'active' AND v_started_at < now() - interval '3 days')
  ) THEN
    RETURN false;
  END IF;

  UPDATE photo_game SET
    theme_index     = (theme_index + 1) % 200,
    started_at      = now(),
    photo_1_url     = null,
    photo_1_user_id = null,
    photo_2_url     = null,
    photo_2_user_id = null,
    vote_1          = null,
    vote_2          = null,
    status          = 'active',
    updated_at      = now()
  WHERE id = 1;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION advance_photo_game() TO authenticated;

-- Bucket de stockage pour les photos du jeu
INSERT INTO storage.buckets (id, name, public)
VALUES ('photo-game', 'photo-game', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated can upload photo-game"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photo-game');

CREATE POLICY "authenticated can read photo-game"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photo-game');
