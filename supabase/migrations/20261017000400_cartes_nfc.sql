-- ---------------------------------------------------------------------------
-- Cartes NFC : redirection et compteur de taps.
--
-- La puce ne contient pas le lien d'avis Google du client. Elle contient une
-- adresse de la société — https://go.taporacards.com/t/K7M2QX — qui redirige.
-- Deux conséquences, et c'est tout l'intérêt :
--
--   • la destination se change d'un clic, sans reprogrammer la carte ni la
--     reprendre au client (nouvelle fiche Google, nouveau menu, promo) ;
--   • chaque tap se compte, et le client voit noir sur blanc que sa carte
--     sert — la preuve qui justifie le prix.
--
-- L'adresse écrite sur la puce est PERMANENTE. Le code ne doit donc jamais
-- être réattribué : une carte supprimée libère sa ligne, pas son code (la
-- contrainte d'unicité porte sur tous les codes jamais émis, voir
-- codes_cartes_emis).
--
-- Vie privée (Loi 25) : un tap n'enregistre ni adresse IP, ni identifiant,
-- ni position. Seulement l'heure, le canal (puce ou QR) et le type
-- d'appareil — assez pour les statistiques, rien qui désigne une personne.
-- ---------------------------------------------------------------------------

-- Tous les codes jamais attribués, pour qu'un code ne serve qu'une fois.
create table if not exists codes_cartes_emis (
  code     text primary key,
  emis_le  timestamptz not null default now()
);

create table if not exists cartes_nfc (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique references codes_cartes_emis (code),
  libelle      text not null check (length(trim(libelle)) > 0),
  client_id    uuid references clients (id) on delete set null,
  destination  text not null check (destination ~* '^https?://'),
  actif        boolean not null default true,
  note         text,
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now(),
  constraint chk_code_carte check (code ~ '^[A-HJ-NP-Z2-9]{6}$')
);

comment on table cartes_nfc is
  'Cartes NFC posées chez les clients : code permanent écrit sur la puce, destination modifiable.';

create table if not exists taps (
  id        bigint generated always as identity primary key,
  carte_id  uuid not null references cartes_nfc (id) on delete cascade,
  tape_le   timestamptz not null default now(),
  canal     text not null check (canal in ('nfc', 'qr')),
  appareil  text not null check (appareil in ('ios', 'android', 'autre'))
);

comment on table taps is
  'Un passage par la redirection. Ni IP, ni identifiant : heure, canal, type d''appareil.';

create index if not exists i_taps_carte_date on taps (carte_id, tape_le desc);
create index if not exists i_taps_date on taps (tape_le desc);

drop trigger if exists t_maj_le on cartes_nfc;
create trigger t_maj_le before update on cartes_nfc
  for each row execute function trg_maj_le();

alter table codes_cartes_emis enable row level security;
alter table cartes_nfc enable row level security;
alter table taps enable row level security;

-- ---------------------------------------------------------------------------
-- Un code neuf : six caractères, sans les signes qui se confondent à la
-- lecture (0/O, 1/I). 32⁶ ≈ un milliard de combinaisons.
-- ---------------------------------------------------------------------------
create or replace function nouveau_code_carte() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidat text;
begin
  loop
    candidat := '';
    for i in 1..6 loop
      candidat := candidat || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    begin
      insert into codes_cartes_emis (code) values (candidat);
      return candidat;
    exception when unique_violation then
      -- déjà émis un jour : on retire
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Statistiques par carte.
-- ---------------------------------------------------------------------------
create or replace view v_cartes_nfc with (security_invoker = true) as
select c.id, c.code, c.libelle, c.destination, c.actif, c.note, c.cree_le,
       c.client_id,
       cl.nom as client_nom,
       count(t.id)::int                                                   as taps_total,
       count(t.id) filter (where t.tape_le >= now() - interval '7 days')::int  as taps_7j,
       count(t.id) filter (where t.tape_le >= now() - interval '30 days')::int as taps_30j,
       count(t.id) filter (where t.tape_le >= now() - interval '60 days'
                             and t.tape_le <  now() - interval '30 days')::int as taps_30j_precedents,
       count(t.id) filter (where t.canal = 'qr')::int                     as taps_qr,
       count(t.id) filter (where t.appareil = 'ios')::int                 as taps_ios,
       count(t.id) filter (where t.appareil = 'android')::int             as taps_android,
       max(t.tape_le)                                                     as dernier_tap
  from cartes_nfc c
  left join clients cl on cl.id = c.client_id
  left join taps t on t.carte_id = c.id
 group by c.id, cl.nom;
