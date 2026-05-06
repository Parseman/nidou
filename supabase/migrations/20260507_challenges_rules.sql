-- Nouvelles colonnes pour les règles du Défi du Lundi
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS difficulty    TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS deadline      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated     BOOLEAN,
  ADD COLUMN IF NOT EXISTS validated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by  TEXT,
  ADD COLUMN IF NOT EXISTS validator_name TEXT;

-- Mise à jour de la contrainte de statut pour accepter les nouvelles valeurs
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_status_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_status_check
  CHECK (status IN ('pending', 'completed', 'proof_submitted', 'validated', 'rejected'));

-- Contrainte sur la difficulté (nullable pour les anciens défis)
ALTER TABLE challenges ADD CONSTRAINT challenges_difficulty_check
  CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard', 'legendary'));
