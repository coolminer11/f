-- ---------------------------------------------------------------------------
-- Un texte de courriel plus concret, pour ne plus finir en indésirables.
--
-- « Voici votre reçu, en pièce jointe » envoyé par une adresse neuve, sans
-- date ni montant, avec un PDF : c'est le gabarit des fausses factures, et
-- Gmail l'a classé comme tel dès le premier envoi. La date, le montant et
-- l'invitation à répondre en font un message d'entreprise reconnaissable.
--
-- Nouveau repère : {details} — « du 17 octobre 2026, d'un montant de
-- 34,49 $ », ou seulement la date pour un document sans prix.
--
-- On ne remplace le texte que s'il est encore celui d'origine : un texte
-- retouché par les associés ne se touche pas.
-- ---------------------------------------------------------------------------

update parametres
   set modele_courriel =
'Bonjour,

Nous espérons que vous allez bien !

Voici votre {document} {numero}{details}. Le PDF est joint à ce courriel.

Pour toute question, répondez simplement à ce message.

Merci de faire affaire avec nous.

Cordialement,
{entreprise}'
 where modele_courriel =
'Bonjour,

Nous espérons que vous allez bien !

Voici votre {document} {numero}, en pièce jointe.

Merci de faire affaire avec nous.

Cordialement,
{entreprise}';

alter table parametres alter column modele_courriel set default
'Bonjour,

Nous espérons que vous allez bien !

Voici votre {document} {numero}{details}. Le PDF est joint à ce courriel.

Pour toute question, répondez simplement à ce message.

Merci de faire affaire avec nous.

Cordialement,
{entreprise}';

comment on column parametres.modele_courriel is
  'Corps du courriel d''envoi d''un document. Repères : {document} {numero} {details} {date} {total} {client} {entreprise}.';
