CREATE TABLE IF NOT EXISTS user_streaks (
  user_id         text  PRIMARY KEY,
  streak          integer  NOT NULL DEFAULT 1,
  last_login_date date     NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can read own streak"
  ON user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "user can insert own streak"
  ON user_streaks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user can update own streak"
  ON user_streaks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);
