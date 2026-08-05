-- Retire le règlement ambiant (+1/-1 par minute selon happiness) de la bourse
-- individuelle : les pièces ne viennent plus que des récompenses ponctuelles
-- (câlin, repas, bain, Photo Duel, Combat, défi hebdo) via award_coins().
alter table user_wallet
  drop column if exists last_coin_update_at,
  drop column if exists coin_rate;
