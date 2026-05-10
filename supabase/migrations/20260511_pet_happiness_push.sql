ALTER TABLE pet
  ADD COLUMN IF NOT EXISTS last_happiness_push_at timestamptz;
