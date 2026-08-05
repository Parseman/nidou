-- =============================================
-- Bourse individuelle (remplace le pot commun couple_settings.coins)
-- =============================================

-- 1. user_wallet : solde par utilisateur
create table if not exists user_wallet (
  user_id             text primary key,
  coins               integer not null default 0,
  last_coin_update_at timestamptz not null default now(),
  coin_rate           integer not null default 0,
  updated_at          timestamptz default now()
);

alter table user_wallet enable row level security;

create policy "user_wallet_read_all"
  on user_wallet for select to authenticated using (true);

create policy "user_wallet_insert_own"
  on user_wallet for insert to authenticated
  with check (auth.uid()::text = user_id);

-- Les récompenses (défi validé par l'autre joueur, etc.) créditent parfois
-- le portefeuille du partenaire : update ouvert, comme battle_state.
create policy "user_wallet_update_all"
  on user_wallet for update to authenticated using (true);

-- 2. RPC atomique : crédite/débite un montant sur la bourse d'un utilisateur
-- (upsert + incrément en une seule opération, évite les races avec le règlement ambiant)
create or replace function award_coins(p_user_id text, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_wallet (user_id, coins, last_coin_update_at, updated_at)
  values (p_user_id, p_amount, now(), now())
  on conflict (user_id) do update
    set coins = user_wallet.coins + p_amount,
        updated_at = now();
end;
$$;

-- 3. Realtime
alter publication supabase_realtime add table user_wallet;
