-- Ajout d'un timestamp pour éviter le spam de notifications
ALTER TABLE pet ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
