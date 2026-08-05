-- Passage au theme suivant du Photo Duel entierement cote serveur : jusqu'ici,
-- advance_photo_game() + l'envoi du push "new_theme" n'etaient declenches que
-- par le client (poll 60s / mount de PhotoGame.tsx) -- si personne n'avait
-- l'app ouverte au moment du passage au jeudi 00h00 Paris, la notif ne partait
-- jamais. Un pg_cron appelle desormais advance_photo_game() toutes les 15 min ;
-- si la partie avance reellement, il notifie les deux joueurs lui-meme.
-- Remplace <SERVICE_ROLE_KEY> par ta cle dans Supabase -> Settings -> API

DO $$ BEGIN PERFORM cron.unschedule('photo-game-advance-new-theme'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'photo-game-advance-new-theme',
  '*/15 * * * *',
  $$
    DO $advance$
    DECLARE
      v_advanced boolean;
    BEGIN
      SELECT advance_photo_game() INTO v_advanced;

      IF v_advanced THEN
        PERFORM net.http_post(
          url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/notify-photo-game',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
          ),
          body    := '{"type":"new_theme"}'::jsonb
        );
      END IF;
    END
    $advance$;
  $$
);
