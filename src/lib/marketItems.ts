// Catalogue du Marché : demandes achetables avec la bourse individuelle (user_wallet).
// Prix fixes, codés en dur — calibrés pour rester rares sur les paliers élevés.

export type MarketTier = 'frequent' | 'occasional' | 'rare'

export type MarketItem = {
  id: string
  label: string
  price: number
  tier: MarketTier
}

export const TIER_LABEL: Record<MarketTier, string> = {
  frequent: 'Fréquent',
  occasional: 'Occasionnel',
  rare: 'Rare',
}

export const MARKET_ITEMS: MarketItem[] = [
  // ── Fréquent (2-3×/semaine) ──
  { id: 'selfie-improvise', label: 'Selfie improvisé, sans se préparer', price: 200, tier: 'frequent' },
  { id: 'photo-tenue-du-jour', label: 'Photo de la tenue du jour', price: 200, tier: 'frequent' },
  { id: 'photo-repas-en-cours', label: 'Photo du repas en cours', price: 200, tier: 'frequent' },
  { id: 'photo-ciel-coucher-soleil', label: 'Photo du ciel / coucher de soleil vu de chez toi', price: 200, tier: 'frequent' },
  { id: 'mot-doux-cache-photo', label: 'Petit mot doux caché dans une photo (post-it visible)', price: 200, tier: 'frequent' },
  { id: 'message-vocal-reveil', label: 'Message vocal doux au réveil', price: 250, tier: 'frequent' },
  { id: 'bonne-nuit-filmee', label: 'Bonne nuit filmée ou chantée', price: 250, tier: 'frequent' },
  { id: 'choisir-coiffure-du-jour', label: 'Choisir la coiffure du jour', price: 250, tier: 'frequent' },
  { id: 'video-coucou-avant-dormir', label: 'Petite vidéo "coucou" avant de dormir', price: 250, tier: 'frequent' },
  { id: 'choisir-tenue-de-lautre', label: "Choisir la tenue de l'autre pour la journée", price: 300, tier: 'frequent' },
  { id: 'compliment-3-jours', label: 'Un compliment sincère écrit, chaque jour pendant 3 jours', price: 300, tier: 'frequent' },
  { id: '5-photos-couleur-choisie', label: 'Prendre 5 photos avec une couleur choisie', price: 300, tier: 'frequent' },
  { id: 'video-danse-improvisee', label: "Vidéo d'une danse improvisée", price: 350, tier: 'frequent' },
  { id: 'session-photo-thematique', label: 'Session photo thématique (5-10 photos, thème choisi)', price: 350, tier: 'frequent' },
  { id: 'vlog-moment-journee', label: "Vidéo vlog d'un moment de la journée (en story)", price: 400, tier: 'frequent' },
  { id: 'story-sans-filtre', label: 'Story "sans filtre" — aperçu brut de ta journée', price: 400, tier: 'frequent' },
  { id: 'photo-epicee', label: 'Demander une photo épicée', price: 450, tier: 'frequent' },

  // ── Occasionnel (~1×/semaine) ──
  { id: 'reveil-chanson-dediee', label: 'Réveil avec une chanson dédiée (appel programmé)', price: 600, tier: 'occasional' },
  { id: 'episode-serie-ensemble', label: 'Regarder un épisode de série ensemble (en appel)', price: 600, tier: 'occasional' },
  { id: 'jeu-en-ligne-ensemble', label: 'Jouer à un jeu en ligne ensemble', price: 600, tier: 'occasional' },
  { id: '10-questions-indiscretes', label: 'Répondre à 10 questions indiscrètes', price: 700, tier: 'occasional' },
  { id: 'appel-video-surprise', label: 'Appel vidéo surprise à une heure imposée', price: 700, tier: 'occasional' },
  { id: 'sport-ensemble-appel', label: 'Faire du sport ensemble en appel (yoga, étirements)', price: 700, tier: 'occasional' },
  { id: 'dessin-fait-main', label: 'Envoyer un dessin fait main', price: 700, tier: 'occasional' },
  { id: 'petit-poeme', label: 'Composer un petit poème', price: 700, tier: 'occasional' },
  { id: 'secret-jamais-dit', label: 'Raconter un secret jamais dit', price: 800, tier: 'occasional' },
  { id: 'dessert-prefere', label: "Cuisiner le dessert préféré de l'autre et l'envoyer en photo", price: 800, tier: 'occasional' },
  { id: 'choisir-nourriture-journee', label: "Choisir entièrement la nourriture de l'autre pour une journée", price: 900, tier: 'occasional' },
  { id: 'cuisiner-en-duo-appel', label: 'Cuisiner "en duo" en appel, chacun son plat', price: 900, tier: 'occasional' },
  { id: 'recette-inconnue-filmee', label: 'Essayer une recette inconnue et filmer le résultat', price: 900, tier: 'occasional' },

  // ── Rare (1-2×/mois) ──
  { id: 'carte-postale', label: 'Envoyer une carte postale', price: 2200, tier: 'rare' },
  { id: 'film-ensemble', label: 'Regarder un film ensemble (en même temps, en appel)', price: 2200, tier: 'rare' },
  { id: 'repas-precis', label: 'Cuisiner un repas précis demandé', price: 2500, tier: 'rare' },
  { id: 'soiree-theme', label: 'Organiser une soirée à thème ensemble (déguisement, ambiance)', price: 2600, tier: 'rare' },
]
