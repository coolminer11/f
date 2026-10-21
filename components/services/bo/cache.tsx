/** Les champs cachés que lisent toutes les actions : l'établissement, la page où revenir, l'ancre où défiler. */
export default function Cache({ etab, retour, ancre, id }: { etab: string; retour: string; ancre?: string; id?: string }) {
  return (
    <>
      <input type="hidden" name="etab" value={etab} />
      <input type="hidden" name="retour" value={retour} />
      {ancre && <input type="hidden" name="ancre" value={ancre} />}
      {id && <input type="hidden" name="id" value={id} />}
    </>
  )
}
