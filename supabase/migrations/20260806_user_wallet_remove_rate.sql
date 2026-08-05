-- Retire le règlement ambiant (+1/-1 par minute selon happiness) de la bourse
-- individuelle : les pièces ne viennent plus que des récompenses ponctuelles
-- (câlin, repas, bain, Photo Duel, Combat, défi hebdo) via award_coins().
alter table user_wallet
  drop column if exists last_coin_update_at,
  drop column if exists coin_rate;

-- award_coins() référençait encore last_coin_update_at : on la réaligne
-- sur le nouveau schéma (user_id, coins, updated_at).
create or replace function award_coins(p_user_id text, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_wallet (user_id, coins, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set coins = user_wallet.coins + p_amount,
        updated_at = now();
end;
$$;
