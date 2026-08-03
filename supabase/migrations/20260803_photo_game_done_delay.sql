-- Le passage au theme suivant depuis l'etat "done" attend desormais 3 jours
-- (comme le delai d'upload), au lieu d'avancer immediatement au clic.
CREATE OR REPLACE FUNCTION advance_photo_game()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status     text;
  v_started_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  SELECT status, started_at, updated_at INTO v_status, v_started_at, v_updated_at
  FROM photo_game WHERE id = 1 FOR UPDATE;

  -- N'avance que si expire depuis 3 jours : active depuis started_at, ou done depuis updated_at
  IF NOT (
    (v_status = 'active' AND v_started_at < now() - interval '3 days')
    OR (v_status = 'done' AND v_updated_at < now() - interval '3 days')
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
