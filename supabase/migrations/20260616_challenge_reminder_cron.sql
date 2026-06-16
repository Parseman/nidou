-- Mise à jour du cron daily-reminder : 2x/jour au lieu de 1x
-- 7h UTC  = 9h Paris (été)  / 8h Paris (hiver)
-- 13h UTC = 15h Paris (été) / 14h Paris (hiver)
-- La fonction gère désormais aussi le cas "aucun défi lancé" (lun-mer)

-- Supprimer l'ancien cron
SELECT cron.unschedule('daily-challenge-reminder');

-- Recréer avec 2 créneaux par jour
-- Remplace <SERVICE_ROLE_KEY> par la clé dans Supabase → Settings → API
SELECT cron.schedule(
  'daily-challenge-reminder',
  '0 7,13 * * *',
  $$
    SELECT net.http_post(
      url    := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/daily-reminder',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body   := '{}'::jsonb
    );
  $$
);

-- Vérifier que le cron est bien enregistré
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-challenge-reminder';
