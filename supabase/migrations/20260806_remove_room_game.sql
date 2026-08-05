-- Retrait complet du jeu "Ma Chambre" (RoomPage/RoomShop/RoomScene, cote client
-- deja supprime) : tables, RPC d'achat, trigger de notif et rappel pg_cron associe.

DO $$ BEGIN PERFORM cron.unschedule('room-upgrade-reminder'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP TRIGGER IF EXISTS on_room_purchase ON room_purchases;
DROP FUNCTION IF EXISTS trigger_notify_room_purchase();
DROP FUNCTION IF EXISTS purchase_room_upgrade(text, text, text, text, integer);

DROP TABLE IF EXISTS room_purchases;
DROP TABLE IF EXISTS rooms;

-- A faire manuellement dans le dashboard Supabase -> Storage :
-- supprimer le bucket "room-photos" (et son contenu) une fois cette migration executee.
