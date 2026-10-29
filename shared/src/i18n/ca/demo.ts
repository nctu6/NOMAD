import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Demo en directe',
  'demo.welcome.title': 'Benvingut a TREK',
  'demo.welcome.tagline':
    'El planificador de viatges per compartir: planifiqueu junts al mapa en temps real, des de la primera idea fins al fotollibre després del viatge.',
  'demo.welcome.resetTitle': 'Tot es restableix cada hora',
  'demo.welcome.resetBody':
    'Explora, edita i crea tant com vulguis. A cada hora en punt la demo torna al seu estat inicial per al visitant següent.',
  'demo.welcome.resetIn': 'Proper restabliment en',
  'demo.welcome.tryTitle': 'Prova-ho ara mateix',
  'demo.feature.planner.title': 'Planificador de viatges',
  'demo.feature.planner.body':
    'Dies, llocs i rutes al mapa, amb vols, hotels, restaurants, reserves i despeses compartides.',
  'demo.feature.tours.title': 'Rutes i excursions',
  'demo.feature.tours.body':
    'Planifica una excursió per la xarxa de camins i segueix-la sobre el relleu 3D amb el perfil d’altitud.',
  'demo.feature.studio.title': 'Fotollibres amb TREK Studio',
  'demo.feature.studio.body': 'Converteix un viatge en un fotollibre dissenyat, pàgina a pàgina.',
  'demo.feature.collab.title': 'Planificar junts en directe',
  'demo.feature.collab.body': 'Tothom al viatge veu cada canvi a l’instant, amb xat, notes i enquestes.',
  'demo.feature.journey.title': 'Diari de viatge Journey',
  'demo.feature.journey.body': 'Entrades, fotos, estats d’ànim, pros i contres de cada dia de viatge.',
  'demo.feature.atlas.title': 'Mapa del món Atlas',
  'demo.feature.atlas.body': 'Els països i les regions que has visitat, amb les teves estadístiques de viatge.',
  'demo.feature.vacay.title': 'Planificador de vacances Vacay',
  'demo.feature.vacay.body': 'Planifica els dies lliures al voltant dels festius i mira quan està lliure tothom.',
  'demo.feature.collections.title': 'Col·leccions',
  'demo.feature.collections.body': 'Desa llocs de diferents viatges en llistes pròpies i copia’ls a qualsevol pla.',
  'demo.feature.offline.title': 'Funciona sense connexió',
  'demo.feature.offline.body': 'Instal·la TREK com a app i conserva plans, mapes i llistes sense connexió.',
  'demo.welcome.limitsTitle': 'Fora de la demo',
  'demo.limit.uploads': 'Pujar fotos, documents i portades',
  'demo.limit.account': 'Canviar el compte, la contrasenya o la 2FA',
  'demo.limit.apiKeys': 'Crear claus d’API',
  'demo.limit.mcp': 'Connectar clients MCP',
  'demo.limit.ai': 'Connectar el teu propi model d’IA',
  'demo.welcome.fullTitle': 'La versió completa afegeix',
  'demo.full.sso': 'Inici de sessió amb OIDC i SSO',
  'demo.full.backups': 'Còpies de seguretat automàtiques',
  'demo.full.plugins': 'Connectors per a funcions noves',
  'demo.full.assistant': 'L’assistent d’IA amb el teu propi model',
  'demo.full.admin': 'Un tauler d’administració per a usuaris, complements i permisos',
  'demo.welcome.repo': 'Codi font a GitHub',
  'demo.welcome.start': 'Comença a explorar',
  'demo.welcome.credits': 'Crèdits de les fotos',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Crèdits de les fotos',
  'demo.credits.intro':
    'Les fotos d’aquesta demo provenen de Wikimedia Commons, cadascuna amb la llicència que s’hi indica. Aquesta llicència només s’aplica a la foto, no a TREK ni a la resta de la demo.',
  'demo.credits.by': 'per {author}',
  'demo.credits.publicDomain': 'Domini públic',
  'demo.credits.back': 'Enrere',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Mode demo',
  'demo.lock.apiKeys': 'A la demo no es poden crear claus d’API.',
  'demo.lock.mcp': 'A la demo no es poden connectar clients MCP.',
  'demo.lock.ai': 'A la demo no es pot afegir una connexió d’IA pròpia.',
  'demo.lock.aiTitle': 'Connecta el teu propi model d’IA',
  'demo.lock.account': 'El compte de demo compartit no es pot modificar.',
  'demo.lock.language': 'La demo sempre funciona en anglès.',
};

export default demo;
