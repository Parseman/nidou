-- =============================================
-- Pondération des drops du Combat : Épée 40% / Bouclier 40% / Cœur 20%
-- (jusqu'ici tirage uniforme, 1/3 chacun)
-- =============================================

create or replace function battle_pick_item()
returns text
language plpgsql
as $$
declare
  v_roll numeric := random();
begin
  if v_roll < 0.4 then
    return 'sword';
  elsif v_roll < 0.8 then
    return 'shield';
  else
    return 'heart';
  end if;
end;
$$;

create or replace function advance_battle_spawn()
returns boolean
language plpgsql
security definer
as $$
declare
  v_row   battle_spawn;
  v_item  text;
  v_delay interval;
begin
  select * into v_row from battle_spawn where id = 1 for update;

  if not found then
    -- Première initialisation
    v_item  := battle_pick_item();
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
  v_item  := battle_pick_item();
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
