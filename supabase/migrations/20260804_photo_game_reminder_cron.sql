-- Rappels Photo Duel (upload/vote en retard), une fois le matin
-- Remplace <SERVICE_ROLE_KEY> par ta clé dans Supabase → Settings → API

DO $$ BEGIN PERFORM cron.unschedule('photo-game-reminder-morning'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7h UTC = 9h Paris (été) / 8h Paris (hiver)
SELECT cron.schedule(
  'photo-game-reminder-morning',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/check-photo-game-push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);
