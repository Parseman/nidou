-- Notifications streak : 20h et 23h heure de Paris
-- Remplace <SERVICE_ROLE_KEY> par ta clé dans Supabase → Settings → API

DO $$ BEGIN PERFORM cron.unschedule('streak-reminder-20h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('streak-reminder-23h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 18h UTC = 20h Paris (été, UTC+2)
SELECT cron.schedule(
  'streak-reminder-20h',
  '0 18 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/check-streak-push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- 21h UTC = 23h Paris (été, UTC+2)
SELECT cron.schedule(
  'streak-reminder-23h',
  '0 21 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/check-streak-push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    );
  $$
);
