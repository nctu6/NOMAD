import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Demo en vivo',
  'demo.welcome.title': 'Bienvenido a TREK',
  'demo.welcome.tagline':
    'El planificador de viajes para compartir: planificad juntos en el mapa en tiempo real, desde la primera idea hasta el fotolibro después del viaje.',
  'demo.welcome.resetTitle': 'Todo se restablece cada hora',
  'demo.welcome.resetBody':
    'Explora, edita y crea todo lo que quieras. A cada hora en punto la demo vuelve a su estado inicial para el siguiente visitante.',
  'demo.welcome.resetIn': 'Próximo restablecimiento en',
  'demo.welcome.tryTitle': 'Pruébalo ahora mismo',
  'demo.feature.planner.title': 'Planificador de viajes',
  'demo.feature.planner.body':
    'Días, lugares y rutas en el mapa, con vuelos, hoteles, restaurantes, reservas y gastos compartidos.',
  'demo.feature.tours.title': 'Rutas y senderismo',
  'demo.feature.tours.body':
    'Planifica una ruta por la red de senderos y síguela sobre relieve 3D con su perfil de altitud.',
  'demo.feature.studio.title': 'Fotolibros con TREK Studio',
  'demo.feature.studio.body': 'Convierte un viaje en un fotolibro diseñado, página a página.',
  'demo.feature.collab.title': 'Planificar juntos en directo',
  'demo.feature.collab.body': 'Todos en el viaje ven cada cambio al instante, con chat, notas y encuestas.',
  'demo.feature.journey.title': 'Diario de viaje Journey',
  'demo.feature.journey.body': 'Entradas, fotos, estados de ánimo, pros y contras de cada día de viaje.',
  'demo.feature.atlas.title': 'Mapa mundial Atlas',
  'demo.feature.atlas.body': 'Los países y regiones que has visitado, con tus estadísticas de viaje.',
  'demo.feature.vacay.title': 'Planificador de vacaciones Vacay',
  'demo.feature.vacay.body': 'Planifica tus días libres en torno a los festivos y mira cuándo están todos libres.',
  'demo.feature.collections.title': 'Colecciones',
  'demo.feature.collections.body':
    'Guarda lugares de distintos viajes en tus propias listas y cópialos a cualquier plan.',
  'demo.feature.offline.title': 'Funciona sin conexión',
  'demo.feature.offline.body': 'Instala TREK como app y conserva tus planes, mapas y listas sin conexión.',
  'demo.welcome.limitsTitle': 'Fuera de la demo',
  'demo.limit.uploads': 'Subir fotos, documentos y portadas',
  'demo.limit.account': 'Cambiar la cuenta, su contraseña o la 2FA',
  'demo.limit.apiKeys': 'Crear claves API',
  'demo.limit.mcp': 'Conectar clientes MCP',
  'demo.limit.ai': 'Conectar tu propio modelo de IA',
  'demo.welcome.fullTitle': 'La versión completa añade',
  'demo.full.sso': 'Inicio de sesión con OIDC y SSO',
  'demo.full.backups': 'Copias de seguridad automáticas',
  'demo.full.plugins': 'Plugins para nuevas funciones',
  'demo.full.assistant': 'El asistente de IA con tu propio modelo',
  'demo.full.admin': 'Un panel de administración para usuarios, complementos y permisos',
  'demo.welcome.repo': 'Código fuente en GitHub',
  'demo.welcome.start': 'Empezar a explorar',
  'demo.welcome.credits': 'Créditos de las fotos',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Créditos de las fotos',
  'demo.credits.intro':
    'Las fotos de esta demo proceden de Wikimedia Commons, cada una con la licencia indicada junto a ella. Esa licencia se aplica solo a la foto, no a TREK ni al resto de la demo.',
  'demo.credits.by': 'por {author}',
  'demo.credits.publicDomain': 'Dominio público',
  'demo.credits.back': 'Volver',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Modo demo',
  'demo.lock.apiKeys': 'En la demo no se pueden crear claves API.',
  'demo.lock.mcp': 'En la demo no se pueden conectar clientes MCP.',
  'demo.lock.ai': 'En la demo no se puede añadir una conexión de IA propia.',
  'demo.lock.aiTitle': 'Conectar tu propio modelo de IA',
  'demo.lock.account': 'La cuenta de demo compartida no se puede modificar.',
  'demo.lock.language': 'La demo siempre funciona en inglés.',
};

export default demo;
