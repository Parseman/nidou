CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     text        NOT NULL,
  endpoint    text        NOT NULL,
  subscription jsonb      NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
