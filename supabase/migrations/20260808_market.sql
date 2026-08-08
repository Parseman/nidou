-- Marché : achat de demandes à l'autre avec la bourse individuelle (user_wallet).
-- Catalogue + prix fixes codés en dur côté client (src/lib/marketItems.ts).

create table if not exists market_purchases (
  id           text primary key default gen_random_uuid()::text,
  item_id      text not null,
  item_label   text not null,
  price        integer not null,
  buyer_id     text not null,
  buyer_name   text,
  status       text not null default 'pending' check (status in ('pending', 'done')),
  proof_url    text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table market_purchases enable row level security;

create policy "market_purchases_read_all"
  on market_purchases for select to authenticated using (true);

create policy "market_purchases_insert_own"
  on market_purchases for insert to authenticated
  with check (auth.uid()::text = buyer_id);

-- Le partenaire (pas l'acheteur) doit pouvoir marquer la demande comme réalisée :
-- update ouvert, même logique que battle_state / user_wallet / feedback_reports.
create policy "market_purchases_update_all"
  on market_purchases for update to authenticated using (true);

alter publication supabase_realtime add table market_purchases;

-- Bucket Storage "market" (preuve photo optionnelle à la réalisation) à créer
-- manuellement dans le dashboard Supabase (public, comme "challenges"/"photo-game").
