-- ---------------------------------------------------------------------------
-- Le texte du courriel qui accompagne un document.
--
-- Rédigé par les associés, pas par le programme : c'est leur voix que le
-- client lit. Le texte par défaut est celui qu'ils envoyaient déjà à la main.
--
-- Quatre repères sont remplacés à l'envoi :
--   {document}   « facture », « reçu de vente », « devis »…
--   {numero}     F-2026-00012
--   {client}     le nom du client
--   {entreprise} le nom de la société, tel qu'il est dans ces paramètres
-- ---------------------------------------------------------------------------

alter table parametres
  add column if not exists modele_courriel text not null default
'Bonjour,

Nous espérons que vous allez bien !

Voici votre {document} {numero}, en pièce jointe.

Merci de faire affaire avec nous.

Cordialement,
{entreprise}';

comment on column parametres.modele_courriel is
  'Corps du courriel d''envoi d''un document. Repères : {document} {numero} {client} {entreprise}.';
