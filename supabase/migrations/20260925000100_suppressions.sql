-- ---------------------------------------------------------------------------
-- Supprimer un document pour de bon — et garder trace de la suppression.
--
-- En comptabilité, on n'efface pas : on annule, on émet une note de crédit. Le
-- registre est censé être une suite ininterrompue, et c'est ce que l'écran
-- « Annuler » fait déjà. Mais une facture d'essai, un doublon, une erreur de
-- saisie du premier jour n'ont rien à faire dans un registre qu'on présentera
-- un jour à Revenu Québec, annulée ou non.
--
-- La suppression est donc possible, avec trois garde-fous :
--   • le numéro du document doit être retapé — on n'efface pas par mégarde ;
--   • un document dont dépend un autre (note de crédit, bon de livraison,
--     crédit déjà appliqué, litige Stripe) est refusé : il faut défaire dans
--     l'ordre, sinon on laisse des orphelins ;
--   • la ligne complète part dans `suppressions` avec son contenu, qui a
--     supprimé et pourquoi. Effacer n'est pas oublier.
--
-- L'exercice clos est déjà protégé par le déclencheur t_exercice, qui couvre
-- aussi la suppression.
-- ---------------------------------------------------------------------------

create table if not exists suppressions (
  id           uuid primary key default gen_random_uuid(),
  objet        text not null,
  numero       text,
  description  text,
  montant      numeric(12,2),
  date_piece   date,
  motif        text,
  supprime_par text,
  supprime_le  timestamptz not null default now(),
  contenu      jsonb not null
);

comment on table suppressions is
  'Trace des documents effacés : ce qu''ils contenaient, qui les a effacés, pourquoi.';

create index if not exists i_suppressions_date on suppressions (supprime_le desc);

alter table suppressions enable row level security;

-- ---------------------------------------------------------------------------

create or replace function supprimer_vente(
  p_id             uuid,
  p_numero_confirme text,
  p_motif          text default null,
  p_par            text default null
) returns void
language plpgsql as $$
declare
  v_vente     ventes%rowtype;
  v_bloquants text;
begin
  select * into v_vente from ventes where id = p_id;
  if not found then
    raise exception 'Document introuvable.';
  end if;

  if trim(p_numero_confirme) is distinct from v_vente.numero then
    raise exception 'Le numéro saisi (%) ne correspond pas au document (%).',
      coalesce(nullif(trim(p_numero_confirme), ''), '—'), v_vente.numero;
  end if;

  -- Documents qui découlent de celui-ci : les effacer d'abord, sinon ils
  -- perdent leur référence en silence.
  select string_agg(numero, ', ' order by numero) into v_bloquants
    from ventes where document_origine_id = p_id;
  if v_bloquants is not null then
    raise exception 'Ce document en a engendré d''autres (%). Supprimez-les d''abord.', v_bloquants;
  end if;

  -- Une note de crédit déjà portée au solde d'une facture : l'effacer
  -- laisserait un paiement sans contrepartie.
  select string_agg(v.numero, ', ' order by v.numero) into v_bloquants
    from paiements_vente p join ventes v on v.id = p.vente_id
   where p.note_credit_id = p_id;
  if v_bloquants is not null then
    raise exception 'Ce crédit est appliqué à % . Retirez le paiement d''abord.', v_bloquants;
  end if;

  select string_agg(coalesce(stripe_charge_id, id::text), ', ') into v_bloquants
    from litiges where vente_id = p_id;
  if v_bloquants is not null then
    raise exception 'Un litige Stripe (%) porte sur ce document. Il doit rester.', v_bloquants;
  end if;

  insert into suppressions (objet, numero, description, montant, date_piece, motif, supprime_par, contenu)
  values (
    'vente',
    v_vente.numero,
    coalesce(v_vente.client_nom, 'sans client'),
    v_vente.montant_ttc,
    v_vente.date,
    nullif(trim(coalesce(p_motif, '')), ''),
    p_par,
    jsonb_build_object(
      'vente', to_jsonb(v_vente),
      'lignes', coalesce((select jsonb_agg(to_jsonb(l) order by l.ordre) from vente_lignes l where l.vente_id = p_id), '[]'::jsonb),
      'transactions', coalesce((select jsonb_agg(to_jsonb(t)) from transactions t where t.vente_id = p_id), '[]'::jsonb),
      'paiements', coalesce((select jsonb_agg(to_jsonb(p)) from paiements_vente p where p.vente_id = p_id), '[]'::jsonb),
      'stock', coalesce((select jsonb_agg(to_jsonb(m)) from inventaire_mouvements m where m.vente_id = p_id), '[]'::jsonb)
    )
  );

  -- Les clés étrangères font le reste en cascade : lignes, paiements,
  -- transactions (et leurs lignes de taxe), mouvements de stock et de caisse,
  -- envois. Ce qui ne cascade pas est bloqué plus haut.
  delete from ventes where id = p_id;
end;
$$;

comment on function supprimer_vente(uuid, text, text, text) is
  'Efface un document et tout ce qu''il a produit, après confirmation du numéro. Trace dans suppressions.';

-- ---------------------------------------------------------------------------
-- Même chose pour une écriture saisie à la main.
--
-- Une écriture née d'un document se supprime avec le document, jamais seule :
-- la facture resterait sans son revenu, et le registre mentirait.
-- ---------------------------------------------------------------------------

create or replace function supprimer_transaction(
  p_id    uuid,
  p_motif text default null,
  p_par   text default null
) returns void
language plpgsql as $$
declare
  v_tx        transactions%rowtype;
  v_numero    text;
  v_bloquants text;
begin
  select * into v_tx from transactions where id = p_id;
  if not found then
    raise exception 'Écriture introuvable.';
  end if;

  if v_tx.vente_id is not null then
    select numero into v_numero from ventes where id = v_tx.vente_id;
    raise exception 'Cette écriture appartient au document %. Supprimez le document.', v_numero;
  end if;

  select string_agg(coalesce(stripe_charge_id, id::text), ', ') into v_bloquants
    from litiges
   where transaction_frais_id = p_id or transaction_reprise_id = p_id or transaction_reversal_id = p_id;
  if v_bloquants is not null then
    raise exception 'Un litige Stripe (%) s''appuie sur cette écriture.', v_bloquants;
  end if;

  if exists (select 1 from denombrements where transaction_id = p_id) then
    raise exception 'Cette écriture est l''ajustement d''un dénombrement d''inventaire.';
  end if;

  insert into suppressions (objet, numero, description, montant, date_piece, motif, supprime_par, contenu)
  values (
    'transaction',
    v_tx.reference_externe,
    v_tx.description,
    v_tx.montant_ttc,
    v_tx.date,
    nullif(trim(coalesce(p_motif, '')), ''),
    p_par,
    jsonb_build_object(
      'transaction', to_jsonb(v_tx),
      'stock', coalesce((select jsonb_agg(to_jsonb(m)) from inventaire_mouvements m where m.transaction_id = p_id), '[]'::jsonb)
    )
  );

  -- Le mouvement de stock ne cascade pas (sa clé est « set null ») : sans ce
  -- retrait, l'achat disparaîtrait de la comptabilité mais les cartes
  -- resteraient en stock, et la marge unitaire deviendrait fausse.
  delete from inventaire_mouvements where transaction_id = p_id;
  delete from transactions where id = p_id;
end;
$$;

comment on function supprimer_transaction(uuid, text, text) is
  'Efface une écriture saisie à la main, son stock associé, avec trace dans suppressions.';
