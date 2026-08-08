-- Historique des tours de Photo Duel : advance_photo_game() archivait jusqu'ici
-- la ligne unique photo_game sans conserver de trace des tours passes. On ajoute
-- une table d'archive alimentee automatiquement a chaque avance de tour, pour
-- permettre d'afficher un historique (theme, date, photos, votes) cote client.
CREATE TABLE IF NOT EXISTS photo_game_history (
  id              serial      PRIMARY KEY,
  theme_index     integer     NOT NULL,
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz NOT NULL DEFAULT now(),
  photo_1_url     text,
  photo_1_user_id text,
  photo_2_url     text,
  photo_2_user_id text,
  vote_1          boolean,
  vote_2          boolean
);

ALTER TABLE photo_game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read photo_game_history"
  ON photo_game_history FOR SELECT TO authenticated USING (true);

-- Remplace advance_photo_game() : archive le tour courant avant de le reinitialiser
CREATE OR REPLACE FUNCTION advance_photo_game()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row             photo_game%ROWTYPE;
  v_now_paris       timestamp;
  v_dow             int;
  v_days_since_thu  int;
  v_round_start     timestamptz;
BEGIN
  SELECT * INTO v_row FROM photo_game WHERE id = 1 FOR UPDATE;

  v_now_paris      := now() AT TIME ZONE 'Europe/Paris';
  v_dow            := EXTRACT(ISODOW FROM v_now_paris)::int; -- lundi=1 .. jeudi=4 .. dimanche=7
  v_days_since_thu := (v_dow - 4 + 7) % 7;
  v_round_start    := ((v_now_paris::date) - v_days_since_thu)::timestamp AT TIME ZONE 'Europe/Paris';

  -- N'avance que si le tour stocke appartient a une semaine anterieure
  -- au tour courant (jeudi 00h00 Paris deja franchi depuis started_at)
  IF NOT (v_row.started_at < v_round_start) THEN
    RETURN false;
  END IF;

  INSERT INTO photo_game_history (
    theme_index, started_at, ended_at,
    photo_1_url, photo_1_user_id, photo_2_url, photo_2_user_id,
    vote_1, vote_2
  ) VALUES (
    v_row.theme_index, v_row.started_at, now(),
    v_row.photo_1_url, v_row.photo_1_user_id, v_row.photo_2_url, v_row.photo_2_user_id,
    v_row.vote_1, v_row.vote_2
  );

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
