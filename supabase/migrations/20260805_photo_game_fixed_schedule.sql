-- Le Photo Duel passe d'un delai flottant (3 jours depuis started_at/updated_at)
-- a un calendrier fixe : chaque tour demarre le jeudi a minuit heure de Paris
-- et se termine (deadline upload/vote) le mardi suivant a 23h59. Le theme
-- suivant ne demarre jamais avant le jeudi 00h00 suivant (mercredi = jour mort).
CREATE OR REPLACE FUNCTION advance_photo_game()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_started_at      timestamptz;
  v_now_paris       timestamp;
  v_dow             int;
  v_days_since_thu  int;
  v_round_start     timestamptz;
BEGIN
  SELECT started_at INTO v_started_at FROM photo_game WHERE id = 1 FOR UPDATE;

  v_now_paris      := now() AT TIME ZONE 'Europe/Paris';
  v_dow            := EXTRACT(ISODOW FROM v_now_paris)::int; -- lundi=1 .. jeudi=4 .. dimanche=7
  v_days_since_thu := (v_dow - 4 + 7) % 7;
  v_round_start    := ((v_now_paris::date) - v_days_since_thu)::timestamp AT TIME ZONE 'Europe/Paris';

  -- N'avance que si le tour stocke appartient a une semaine anterieure
  -- au tour courant (jeudi 00h00 Paris deja franchi depuis started_at)
  IF NOT (v_started_at < v_round_start) THEN
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
