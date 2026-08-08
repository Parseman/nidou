-- Idées & bugs : les deux users peuvent signaler une idée ou un bug,
-- consultable et supprimable par l'un ou l'autre depuis les Paramètres.

create table if not exists feedback_reports (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null,
  author_name text,
  type        text not null check (type in ('bug', 'idea')),
  description text not null,
  created_at  timestamptz not null default now()
);

alter table feedback_reports enable row level security;

create policy "feedback_reports_read_all"
  on feedback_reports for select to authenticated using (true);

create policy "feedback_reports_insert_own"
  on feedback_reports for insert to authenticated
  with check (auth.uid()::text = user_id);

-- Chacun peut supprimer n'importe quelle entrée (même logique que battle_state /
-- user_wallet : les deux users gèrent ensemble le même espace partagé).
create policy "feedback_reports_delete_all"
  on feedback_reports for delete to authenticated using (true);
