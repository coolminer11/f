import type { Texte } from '@/lib/services/langues'

/**
 * Les données de Tapora Services. Aucune dépendance serveur : les composants
 * du navigateur (éditeur, pages clients) partagent ces types et ces listes.
 */

export type TypeEtablissement = 'restaurant' | 'hotel'

/** Ce que l'établissement active pour ses clients ; tout est réglable dans le back-office. */
export type Options = {
  menu: boolean
  appel: boolean
  concierge: boolean
  wifi: boolean
  avis: boolean
  /** Recherche et filtres (végé, sans gluten…) dans le menu. */
  recherche: boolean
  prix: boolean
  allergenes: boolean
  photos: boolean
  /**
   * Commander depuis le menu : à la table (restaurant, tous les menus servis
   * en ce moment) ou en chambre (hôtel, menus « service aux chambres »). Le
   * paiement reste à l'addition ou porté à la chambre.
   */
  commande: boolean
  /** Fuseau des heures de service des menus. */
  fuseau: string
  /** Message affiché après une demande, par langue (sinon le message par défaut). */
  merci?: Texte
}

export function optionsParDefaut(type: TypeEtablissement): Options {
  return {
    menu: true,
    appel: true,
    concierge: type === 'hotel',
    wifi: true,
    avis: true,
    recherche: true,
    prix: true,
    allergenes: true,
    photos: true,
    commande: type === 'hotel',
    fuseau: 'America/Toronto',
  }
}

export type Etablissement = {
  id: string
  type: TypeEtablissement
  nom: string
  langues: string[]
  langue_defaut: string
  couleur: string
  logo: string | null
  couverture: string | null
  accueil: Texte
  adresse: string | null
  telephone: string | null
  site_web: string | null
  avis_url: string | null
  wifi_nom: string | null
  wifi_mdp: string | null
  devise: string
  options: Options
  version_lien: number
  protege: boolean
  actif: boolean
  formule: 'essai' | 'actif' | 'suspendu'
  essai_jusqua: string | null
  prix_mensuel: number | null
  contact_nom: string | null
  contact_courriel: string | null
  notes: string | null
  cree_le: string
}

export type Emplacement = {
  id: string
  etablissement_id: string
  type: 'table' | 'chambre' | 'zone' | 'comptoir'
  libelle: string
  groupe: string | null
  code: string
  actif: boolean
  ordre: number
}

export type Variante = { nom: Texte; prix: number | null }

export type Plat = {
  id: string
  section_id: string
  nom: Texte
  description: Texte
  prix: number | null
  variantes: Variante[]
  photo: string | null
  allergenes: string[]
  etiquettes: string[]
  disponible: boolean
  ordre: number
}

export type Section = { id: string; menu_id: string; nom: Texte; description: Texte; ordre: number; plats: Plat[] }

export type Menu = {
  id: string
  type: 'carte' | 'boissons' | 'room_service' | 'dejeuner' | 'autre'
  nom: Texte
  description: Texte
  pdf: Record<string, string>
  heure_debut: string | null
  heure_fin: string | null
  jours: number[]
  actif: boolean
  ordre: number
  sections: Section[]
  /** Calculé : servi en ce moment (heures et jours). */
  en_service?: boolean
}

export type Annonce = {
  id: string
  type: 'plat_du_jour' | 'promo' | 'info' | 'evenement'
  titre: Texte
  texte: Texte
  prix: number | null
  debut: string | null
  fin: string | null
  actif: boolean
  ordre: number
}

export type Rubrique = {
  id: string
  type: 'horaires' | 'service' | 'restauration' | 'activite' | 'recommandation' | 'transport' | 'urgence' | 'regle' | 'autre'
  icone: string | null
  titre: Texte
  texte: Texte
  lien: string | null
  telephone: string | null
  actif: boolean
  ordre: number
}

export type TypeDemande = {
  id: string
  cle: string
  libelle: Texte
  icone: string | null
  avec_note: boolean
  avis_apres: boolean
  actif: boolean
  ordre: number
}

export type StatutDemande = 'nouvelle' | 'prise' | 'faite' | 'annulee'

/**
 * Une ligne de commande, telle que gardée avec la demande : les noms dans la
 * langue de l'établissement (pour la cuisine) et, s'il lisait une autre
 * langue, dans celle du client ; le prix est celui du menu au moment de la
 * commande, recalculé par le serveur (null : prix à confirmer).
 */
export type LigneCommande = {
  plat_id: string
  nom: string
  nom_client?: string | null
  variante?: string | null
  variante_client?: string | null
  prix: number | null
  quantite: number
  /** La précision du client pour ce plat (« bien cuit », « sans oignons »). */
  note?: string | null
}

export type Demande = {
  id: string
  emplacement_id: string | null
  emplacement: string | null
  groupe: string | null
  cle: string
  libelle: string
  icone: string | null
  note: string | null
  langue: string
  statut: StatutDemande
  prise_par: string | null
  cree_le: string
  prise_le: string | null
  faite_le: string | null
  /** Une commande (cle = 'commande') : ses lignes et son total. */
  details?: LigneCommande[] | null
  total?: number | null
}

/** Les demandes proposées à la création d'un établissement (modifiables ensuite). */
export const DEMANDES_PAR_DEFAUT: Record<TypeEtablissement, Omit<TypeDemande, 'id' | 'actif'>[]> = {
  restaurant: [
    { cle: 'serveur', icone: '🙋', avec_note: false, avis_apres: true, ordre: 1, libelle: { fr: 'Appeler le serveur', en: 'Call the server', es: 'Llamar al camarero', de: 'Bedienung rufen', it: 'Chiama il cameriere', pt: 'Chamar o empregado', zh: '呼叫服务员', ja: 'スタッフを呼ぶ', ko: '직원 호출', ar: 'استدعاء النادل' } },
    { cle: 'addition', icone: '🧾', avec_note: false, avis_apres: true, ordre: 2, libelle: { fr: 'L’addition, s’il vous plaît', en: 'The bill, please', es: 'La cuenta, por favor', de: 'Die Rechnung, bitte', it: 'Il conto, per favore', pt: 'A conta, por favor', zh: '请结账', ja: 'お会計をお願いします', ko: '계산서 주세요', ar: 'الحساب من فضلك' } },
    { cle: 'eau', icone: '💧', avec_note: false, avis_apres: false, ordre: 3, libelle: { fr: 'De l’eau', en: 'Water', es: 'Agua', de: 'Wasser', it: 'Acqua', pt: 'Água', zh: '加水', ja: 'お水', ko: '물', ar: 'ماء' } },
    { cle: 'autre', icone: '✍️', avec_note: true, avis_apres: false, ordre: 4, libelle: { fr: 'Autre chose', en: 'Something else', es: 'Otra cosa', de: 'Etwas anderes', it: 'Altro', pt: 'Outra coisa', zh: '其他', ja: 'その他', ko: '기타', ar: 'شيء آخر' } },
  ],
  hotel: [
    { cle: 'serviettes', icone: '🧺', avec_note: false, avis_apres: false, ordre: 1, libelle: { fr: 'Serviettes propres', en: 'Fresh towels', es: 'Toallas limpias', de: 'Frische Handtücher', it: 'Asciugamani puliti', pt: 'Toalhas limpas', zh: '干净毛巾', ja: '新しいタオル', ko: '새 수건', ar: 'مناشف نظيفة' } },
    { cle: 'oreillers', icone: '🛏️', avec_note: false, avis_apres: false, ordre: 2, libelle: { fr: 'Oreillers supplémentaires', en: 'Extra pillows', es: 'Almohadas extra', de: 'Zusätzliche Kissen', it: 'Cuscini extra', pt: 'Almofadas extra', zh: '加枕头', ja: '枕の追加', ko: '베개 추가', ar: 'وسائد إضافية' } },
    { cle: 'menage', icone: '🧹', avec_note: false, avis_apres: false, ordre: 3, libelle: { fr: 'Ménage de la chambre', en: 'Room cleaning', es: 'Limpieza de la habitación', de: 'Zimmerreinigung', it: 'Pulizia della camera', pt: 'Limpeza do quarto', zh: '打扫房间', ja: '客室清掃', ko: '객실 청소', ar: 'تنظيف الغرفة' } },
    { cle: 'produits', icone: '🧴', avec_note: false, avis_apres: false, ordre: 4, libelle: { fr: 'Produits de toilette', en: 'Toiletries', es: 'Artículos de aseo', de: 'Pflegeprodukte', it: 'Prodotti da bagno', pt: 'Produtos de higiene', zh: '洗漱用品', ja: 'アメニティ', ko: '세면도구', ar: 'مستلزمات الحمام' } },
    { cle: 'depart_tardif', icone: '⏰', avec_note: true, avis_apres: false, ordre: 5, libelle: { fr: 'Départ tardif', en: 'Late check-out', es: 'Salida tardía', de: 'Später Check-out', it: 'Check-out posticipato', pt: 'Check-out tardio', zh: '延迟退房', ja: 'レイトチェックアウト', ko: '늦은 체크아웃', ar: 'مغادرة متأخرة' } },
    { cle: 'reveil', icone: '🔔', avec_note: true, avis_apres: false, ordre: 6, libelle: { fr: 'Appel de réveil', en: 'Wake-up call', es: 'Llamada despertador', de: 'Weckruf', it: 'Sveglia', pt: 'Chamada de despertar', zh: '叫醒服务', ja: 'モーニングコール', ko: '모닝콜', ar: 'مكالمة إيقاظ' } },
    { cle: 'entretien', icone: '🔧', avec_note: true, avis_apres: false, ordre: 7, libelle: { fr: 'Quelque chose ne fonctionne pas', en: 'Something isn’t working', es: 'Algo no funciona', de: 'Etwas funktioniert nicht', it: 'Qualcosa non funziona', pt: 'Algo não funciona', zh: '设施故障', ja: '設備の不具合', ko: '고장 신고', ar: 'شيء لا يعمل' } },
    { cle: 'autre', icone: '✍️', avec_note: true, avis_apres: false, ordre: 8, libelle: { fr: 'Autre demande', en: 'Other request', es: 'Otra solicitud', de: 'Andere Anfrage', it: 'Altra richiesta', pt: 'Outro pedido', zh: '其他需求', ja: 'その他のご要望', ko: '기타 요청', ar: 'طلب آخر' } },
  ],
}

/** Les 11 allergènes prioritaires de Santé Canada. */
export const ALLERGENES = [
  { cle: 'gluten', icone: '🌾', fr: 'Gluten (blé)', en: 'Gluten (wheat)', es: 'Gluten (trigo)' },
  { cle: 'arachides', icone: '🥜', fr: 'Arachides', en: 'Peanuts', es: 'Cacahuetes' },
  { cle: 'noix', icone: '🌰', fr: 'Noix', en: 'Tree nuts', es: 'Frutos secos' },
  { cle: 'lait', icone: '🥛', fr: 'Lait', en: 'Milk', es: 'Leche' },
  { cle: 'oeufs', icone: '🥚', fr: 'Œufs', en: 'Eggs', es: 'Huevos' },
  { cle: 'poisson', icone: '🐟', fr: 'Poisson', en: 'Fish', es: 'Pescado' },
  { cle: 'crustaces', icone: '🦐', fr: 'Crustacés et mollusques', en: 'Shellfish', es: 'Mariscos' },
  { cle: 'soja', icone: '🫘', fr: 'Soja', en: 'Soy', es: 'Soja' },
  { cle: 'sesame', icone: '⚪', fr: 'Sésame', en: 'Sesame', es: 'Sésamo' },
  { cle: 'moutarde', icone: '🟡', fr: 'Moutarde', en: 'Mustard', es: 'Mostaza' },
  { cle: 'sulfites', icone: '🍷', fr: 'Sulfites', en: 'Sulphites', es: 'Sulfitos' },
] as const

export const ETIQUETTES = [
  { cle: 'vegetarien', icone: '🥕', fr: 'Végétarien', en: 'Vegetarian', es: 'Vegetariano' },
  { cle: 'vegan', icone: '🌱', fr: 'Végane', en: 'Vegan', es: 'Vegano' },
  { cle: 'sans_gluten', icone: '🚫🌾', fr: 'Sans gluten', en: 'Gluten-free', es: 'Sin gluten' },
  { cle: 'epice', icone: '🌶️', fr: 'Épicé', en: 'Spicy', es: 'Picante' },
  { cle: 'populaire', icone: '⭐', fr: 'Populaire', en: 'Popular', es: 'Popular' },
  { cle: 'nouveau', icone: '✨', fr: 'Nouveau', en: 'New', es: 'Nuevo' },
  { cle: 'maison', icone: '🏡', fr: 'Fait maison', en: 'Homemade', es: 'Casero' },
  { cle: 'local', icone: '🍁', fr: 'Produit local', en: 'Local', es: 'Local' },
  { cle: 'chef', icone: '👨‍🍳', fr: 'Choix du chef', en: 'Chef’s pick', es: 'Del chef' },
] as const

export const RUBRIQUES = [
  { cle: 'horaires', icone: '🕐', fr: 'Horaires' },
  { cle: 'service', icone: '🛎️', fr: 'Services' },
  { cle: 'restauration', icone: '🍽️', fr: 'Restauration' },
  { cle: 'activite', icone: '🎯', fr: 'Activités' },
  { cle: 'recommandation', icone: '📍', fr: 'Nos recommandations' },
  { cle: 'transport', icone: '🚕', fr: 'Transport' },
  { cle: 'urgence', icone: '🚨', fr: 'Urgences' },
  { cle: 'regle', icone: '📋', fr: 'À savoir' },
  { cle: 'autre', icone: 'ℹ️', fr: 'Autre' },
] as const

/** Le libellé d'un allergène ou d'une étiquette dans la langue voulue (l'anglais sinon). */
export function libelleListe(liste: readonly { cle: string; fr: string; en: string; es: string }[], cle: string, langue: string): string {
  const x = liste.find((e) => e.cle === cle)
  if (!x) return cle
  return (x as Record<string, string>)[langue] ?? x.en
}
