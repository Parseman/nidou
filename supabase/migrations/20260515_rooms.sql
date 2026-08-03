-- ── Table rooms ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  user_id              text    PRIMARY KEY,
  wall_color           text    NOT NULL DEFAULT '#fce7f3',
  floor_color          text    NOT NULL DEFAULT '#d4a96a',
  light_ambiance       text    NOT NULL DEFAULT 'day',
  objects              jsonb   NOT NULL DEFAULT '["bed","plant"]'::jsonb,
  unlocked_objects     jsonb   NOT NULL DEFAULT '["bed","plant"]'::jsonb,
  photo_slots          integer NOT NULL DEFAULT 2,
  photos               jsonb   NOT NULL DEFAULT '[]'::jsonb,
  stickers             jsonb   NOT NULL DEFAULT '[]'::jsonb,
  custom_sticker_slots integer NOT NULL DEFAULT 0,
  custom_stickers      jsonb   NOT NULL DEFAULT '[]'::jsonb,
  room_size_level      integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read all rooms"
  ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "user can insert own room"
  ON rooms FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "user can update own room"
  ON rooms FOR UPDATE TO authenticated USING (user_id = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ── Table room_purchases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_purchases (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   text        NOT NULL,
  buyer_name text,
  item_id    text        NOT NULL,
  item_label text        NOT NULL,
  cost       integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE room_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read all room_purchases"
  ON room_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "user can insert own room_purchases"
  ON room_purchases FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid()::text);

-- ── RPC : achat atomique (déduction coins + enregistrement) ──────────────────
CREATE OR REPLACE FUNCTION purchase_room_upgrade(
  p_buyer_id   text,
  p_buyer_name text,
  p_item_id    text,
  p_item_label text,
  p_cost       integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins integer;
BEGIN
  -- Vérification que l'appelant est bien le buyer
  IF p_buyer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  -- Lock + lecture des pièces
  SELECT coins INTO v_coins FROM couple_settings WHERE id = 1 FOR UPDATE;

  IF v_coins IS NULL OR v_coins < p_cost THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_enough_coins', 'coins', COALESCE(v_coins, 0));
  END IF;

  -- Déduction
  UPDATE couple_settings
    SET coins = coins - p_cost, updated_at = now()
  WHERE id = 1;

  -- Enregistrement de l'achat (déclenche la notif push via trigger)
  INSERT INTO room_purchases (buyer_id, buyer_name, item_id, item_label, cost)
  VALUES (p_buyer_id, p_buyer_name, p_item_id, p_item_label, p_cost);

  RETURN jsonb_build_object('success', true, 'new_coins', v_coins - p_cost);
END;
$$;

-- ── Trigger : notif push lors d'un achat ─────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_room_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM supabase_functions.http_request(
    'https://xymhisdmffdgarabglne.supabase.co/functions/v1/send-push'::text,
    'POST'::text,
    '{"Content-Type":"application/json"}'::jsonb,
    jsonb_build_object(
      'type',   'INSERT',
      'table',  'room_purchases',
      'record', jsonb_build_object(
        'buyer_id',   NEW.buyer_id,
        'buyer_name', NEW.buyer_name,
        'item_label', NEW.item_label,
        'cost',       NEW.cost
      )
    )::text,
    5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_purchase
  AFTER INSERT ON room_purchases
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_room_purchase();

-- ── pg_cron : rappel quotidien "assez de pièces" (11h UTC = 13h Paris) ───────
-- À exécuter après déploiement de daily-reminder (modifié pour inclure le check coins) :
-- SELECT cron.schedule(
--   'room-upgrade-reminder',
--   '0 9 * * *',
--   $$ SELECT net.http_post(
--     url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/daily-reminder',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
--     body    := '{"check":"coins"}'::jsonb
--   ) $$
-- );

-- ── Storage bucket room-photos ────────────────────────────────────────────────
-- À créer manuellement dans le dashboard Supabase → Storage :
-- Bucket name : room-photos
-- Public      : true
-- Allowed MIME types : image/*
