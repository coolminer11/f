-- ---------------------------------------------------------------------------
-- « Pour toute question, écrivez-nous à contact@… » plutôt que « répondez à
-- ce message ».
--
-- Les reçus partent de recus@ : une adresse d'envoi, pas celle que l'on
-- retient. Nommer l'adresse de contact donne au client la bonne, celle qu'il
-- retrouvera aussi sur la facture.
--
-- Nouveau repère : {contact} — parametres.courriel_contact, ou à défaut
-- l'adresse qui envoie. Le texte n'est remplacé que s'il est encore celui
-- posé par la migration précédente.
-- ---------------------------------------------------------------------------

update parametres
   set modele_courriel = replace(
         modele_courriel,
         'Pour toute question, répondez simplement à ce message.',
         'Pour toute question, écrivez-nous à {contact}.')
 where modele_courriel like '%Pour toute question, répondez simplement à ce message.%';

alter table parametres alter column modele_courriel set default
'Bonjour,

Nous espérons que vous allez bien !

Voici votre {document} {numero}{details}. Le PDF est joint à ce courriel.

Pour toute question, écrivez-nous à {contact}.

Merci de faire affaire avec nous.

Cordialement,
{entreprise}';

comment on column parametres.modele_courriel is
  'Corps du courriel d''envoi d''un document. Repères : {document} {numero} {details} {date} {total} {client} {contact} {entreprise}.';
