import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { chargerLieu } from '@/lib/services/client'
import { ui, type CleUi } from '@/lib/services/ui'

export type ParamsLieu = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const un = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)

/**
 * Le lieu d'une page client : le code (toujours en majuscules — une carte
 * mal recopiée en minuscules est redirigée), la langue demandée (?l=), et
 * l'établissement. Sinon, la page « carte pas encore activée ».
 */
export async function lieuDeLaPage({ params, searchParams }: ParamsLieu, suite = '') {
  const { code: brut } = await params
  const sp = await searchParams
  const l = un(sp.l)
  const code = brut.toUpperCase()
  if (brut !== code && /^[a-z0-9]{8}$/i.test(brut)) {
    const reste = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString()
    redirect(`/s/${code}${suite}${reste ? `?${reste}` : ''}`)
  }
  const lieu = await chargerLieu(code, l)
  if (!lieu) notFound()
  const { etab, langue } = lieu
  /** Un lien interne qui garde la langue quand elle n'est pas celle de l'établissement. */
  const lien = (chemin: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ ...extra, ...(langue !== etab.langue_defaut ? { l: langue } : {}) }).toString()
    return `/s/${code}${chemin}${q ? `?${q}` : ''}`
  }
  return { code, l, lieu, sp, lien, un }
}

/** Le titre de l'onglet : le nom de l'établissement, et la page. */
export async function titreLieu({ params, searchParams }: ParamsLieu, page?: CleUi): Promise<string> {
  const { code } = await params
  const l = un((await searchParams).l)
  const lieu = await chargerLieu(code.toUpperCase(), l).catch(() => null)
  if (!lieu) return 'Tapora'
  return page ? `${ui(lieu.langue, page)} · ${lieu.etab.nom}` : lieu.etab.nom
}
