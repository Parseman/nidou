-- =============================================
-- Fix : notification manquante à l'apparition d'un item de Combat
-- advance_battle_spawn() ne renvoyait rien, le client ne savait donc
-- jamais si SON appel venait de faire apparaître un nouvel item
-- (et ne pouvait donc pas notifier sans risquer les doublons).
-- =============================================

drop function if exists advance_battle_spawn();

create function advance_battle_spawn()
returns boolean
language plpgsql
security definer
as $$
declare
  v_row   battle_spawn;
  v_items text[] := array['sword', 'heart', 'shield'];
  v_item  text;
  v_delay interval;
begin
  select * into v_row from battle_spawn where id = 1 for update;

  if not found then
    -- Première initialisation
    v_item  := v_items[1 + (floor(random() * 3))::int];
    v_delay := make_interval(hours => 3 + (floor(random() * 5))::int);
    insert into battle_spawn (id, item_type, spawned_at, claimed_by, next_spawn_at)
    values (1, v_item, now(), null, now() + v_delay);
    return true;
  end if;

  -- Pas encore l'heure
  if now() < v_row.next_spawn_at then
    return false;
  end if;

  -- Avance au prochain item
  v_item  := v_items[1 + (floor(random() * 3))::int];
  v_delay := make_interval(hours => 3 + (floor(random() * 5))::int);
  update battle_spawn set
    item_type     = v_item,
    spawned_at    = now(),
    claimed_by    = null,
    claimed_at    = null,
    next_spawn_at = now() + v_delay
  where id = 1;

  return true;
end;
$$;
