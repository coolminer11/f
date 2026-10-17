-- ---------------------------------------------------------------------------
-- Temps de réponse de chaque redirection, en millisecondes.
--
-- C'est le chiffre qui dit si le serveur suit : le client au comptoir ne voit
-- ni le processeur ni la base, il voit combien de temps la page met à
-- s'ouvrir. Le moniteur en direct en tire la médiane et le 95e centile.
-- Facultatif : les taps enregistrés avant cette migration n'en ont pas.
-- ---------------------------------------------------------------------------
alter table taps add column if not exists duree_ms integer check (duree_ms is null or duree_ms >= 0);
