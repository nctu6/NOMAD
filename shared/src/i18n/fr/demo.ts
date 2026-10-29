import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Démo en direct',
  'demo.welcome.title': 'Bienvenue sur TREK',
  'demo.welcome.tagline':
    'Le planificateur de voyage à partager : planifiez ensemble sur la carte en temps réel, de la première idée au livre photo après le voyage.',
  'demo.welcome.resetTitle': 'Tout est réinitialisé chaque heure',
  'demo.welcome.resetBody':
    'Explorez, modifiez et créez autant que vous voulez. À chaque heure pile, la démo revient à son état initial pour le visiteur suivant.',
  'demo.welcome.resetIn': 'Prochaine réinitialisation dans',
  'demo.welcome.tryTitle': 'À essayer tout de suite',
  'demo.feature.planner.title': 'Planificateur de voyage',
  'demo.feature.planner.body':
    'Jours, lieux et itinéraires sur la carte, avec vols, hôtels, restaurants, réservations et frais partagés.',
  'demo.feature.tours.title': 'Randonnées et circuits',
  'demo.feature.tours.body':
    'Tracez une randonnée sur le réseau de sentiers et suivez la en relief 3D avec son profil d’altitude.',
  'demo.feature.studio.title': 'Livres photo avec TREK Studio',
  'demo.feature.studio.body': 'Transformez un voyage en livre photo mis en page, page après page.',
  'demo.feature.collab.title': 'Planifier ensemble en direct',
  'demo.feature.collab.body': 'Chaque participant voit chaque modification aussitôt, avec chat, notes et sondages.',
  'demo.feature.journey.title': 'Carnet de voyage Journey',
  'demo.feature.journey.body': 'Récits, photos, humeurs, points forts et points faibles de chaque jour sur la route.',
  'demo.feature.atlas.title': 'Carte du monde Atlas',
  'demo.feature.atlas.body': 'Les pays et régions que vous avez visités, avec vos statistiques de voyage.',
  'demo.feature.vacay.title': 'Planificateur de congés Vacay',
  'demo.feature.vacay.body': 'Planifiez vos congés autour des jours fériés et voyez quand tout le monde est libre.',
  'demo.feature.collections.title': 'Listes de lieux',
  'demo.feature.collections.body':
    'Enregistrez des lieux d’un voyage à l’autre dans vos propres listes et copiez les dans n’importe quel plan.',
  'demo.feature.offline.title': 'Fonctionne hors ligne',
  'demo.feature.offline.body':
    'Installez TREK comme une application et gardez vos plans, cartes et listes sans connexion.',
  'demo.welcome.limitsTitle': 'Absent de la démo',
  'demo.limit.uploads': 'Envoyer des photos, documents et couvertures',
  'demo.limit.account': 'Modifier le compte, son mot de passe ou la 2FA',
  'demo.limit.apiKeys': 'Créer des clés API',
  'demo.limit.mcp': 'Connecter des clients MCP',
  'demo.limit.ai': 'Connecter votre propre modèle d’IA',
  'demo.welcome.fullTitle': 'La version complète ajoute',
  'demo.full.sso': 'Connexion avec OIDC et SSO',
  'demo.full.backups': 'Sauvegardes automatiques',
  'demo.full.plugins': 'Des plugins pour de nouvelles fonctions',
  'demo.full.assistant': 'L’assistant IA avec votre propre modèle',
  'demo.full.admin': 'Un espace d’administration pour les utilisateurs, modules et permissions',
  'demo.welcome.repo': 'Code source sur GitHub',
  'demo.welcome.start': 'Commencer la visite',
  'demo.welcome.credits': 'Crédits photo',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Crédits photo',
  'demo.credits.intro':
    'Les photos de cette démo proviennent de Wikimedia Commons, chacune sous la licence indiquée à côté. Cette licence s’applique uniquement à la photo, pas à TREK ni au reste de la démo.',
  'demo.credits.by': 'par {author}',
  'demo.credits.publicDomain': 'Domaine public',
  'demo.credits.back': 'Retour',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Mode démo',
  'demo.lock.apiKeys': 'Impossible de créer des clés API dans la démo.',
  'demo.lock.mcp': 'Impossible de connecter des clients MCP dans la démo.',
  'demo.lock.ai': 'Impossible d’ajouter votre propre connexion IA dans la démo.',
  'demo.lock.aiTitle': 'Connecter votre propre modèle d’IA',
  'demo.lock.account': 'Le compte de démo partagé ne peut pas être modifié.',
  'demo.lock.language': 'La démo fonctionne toujours en anglais.',
};

export default demo;
