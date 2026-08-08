-- Apparition des items de Combat entierement cote serveur : jusqu'ici,
-- advance_battle_spawn() + l'envoi du push "item_spawned" n'etaient
-- declenches que par le client (mount de BattleGame.tsx) -- si personne
-- n'avait l'app ouverte au moment ou le delai 3-7h expirait, l'item
-- apparaissait quand meme (visible au prochain chargement) mais sans
-- jamais notifier personne. Un pg_cron appelle desormais
-- advance_battle_spawn() toutes les 15 min ; si un nouvel item apparait
-- reellement, il notifie les deux joueurs lui-meme.
-- Remplace <SERVICE_ROLE_KEY> par ta cle dans Supabase -> Settings -> API

DO $$ BEGIN PERFORM cron.unschedule('battle-spawn-advance'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'battle-spawn-advance',
  '*/15 * * * *',
  $$
    DO $advance$
    DECLARE
      v_spawned  boolean;
      v_item     text;
    BEGIN
      SELECT advance_battle_spawn() INTO v_spawned;

      IF v_spawned THEN
        SELECT item_type INTO v_item FROM battle_spawn WHERE id = 1;

        PERFORM net.http_post(
          url     := 'https://xymhisdmffdgarabglne.supabase.co/functions/v1/notify-battle',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
          ),
          body    := jsonb_build_object('type', 'item_spawned', 'item_type', v_item)
        );
      END IF;
    END
    $advance$;
  $$
);
