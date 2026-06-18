-- =============================================
-- Battle Game
-- =============================================

-- 1. battle_state : état par utilisateur (PV, XP, bouclier)
create table if not exists battle_state (
  user_id        text primary key,
  hp             integer not null default 10 check (hp between 0 and 10),
  xp             integer not null default 0,
  shield_type    text    default null check (shield_type in ('normal','enhanced')),
  shield_charges integer not null default 0,
  updated_at     timestamptz default now()
);

alter table battle_state enable row level security;

create policy "battle_state_read_all"
  on battle_state for select to authenticated using (true);

create policy "battle_state_insert_own"
  on battle_state for insert to authenticated
  with check (auth.uid()::text = user_id);

-- Les deux joueurs peuvent UPDATE (attaques cross-player)
create policy "battle_state_update_all"
  on battle_state for update to authenticated using (true);

-- 2. battle_inventory : inventaire privé (invisible pour l'adversaire)
create table if not exists battle_inventory (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  item_type   text not null check (item_type in ('sword','enhanced_sword','heart','shield','enhanced_shield')),
  created_at  timestamptz default now()
);

alter table battle_inventory enable row level security;

create policy "battle_inventory_own"
  on battle_inventory for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 3. battle_spawn : item disponible à ramasser (ligne unique id=1)
create table if not exists battle_spawn (
  id            integer primary key default 1,
  item_type     text not null check (item_type in ('sword','heart','shield')),
  spawned_at    timestamptz not null default now(),
  claimed_by    text default null,
  claimed_at    timestamptz default null,
  next_spawn_at timestamptz not null
);

alter table battle_spawn enable row level security;

create policy "battle_spawn_read"
  on battle_spawn for select to authenticated using (true);

create policy "battle_spawn_write"
  on battle_spawn for all to authenticated
  using (true) with check (true);

-- 4. RPC atomique : avance le spawn si l'heure est venue
create or replace function advance_battle_spawn()
returns void
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
    return;
  end if;

  -- Pas encore l'heure
  if now() < v_row.next_spawn_at then
    return;
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
end;
$$;

-- 5. Realtime
alter publication supabase_realtime add table battle_state;
alter publication supabase_realtime add table battle_spawn;
