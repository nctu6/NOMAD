import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Живая демоверсия',
  'demo.welcome.title': 'Добро пожаловать в TREK',
  'demo.welcome.tagline':
    'Планировщик путешествий для совместной работы: планируйте вместе на карте в реальном времени, от первой идеи до фотокниги после поездки.',
  'demo.welcome.resetTitle': 'Каждый час всё сбрасывается',
  'demo.welcome.resetBody':
    'Смотрите, редактируйте и создавайте сколько угодно. В начале каждого часа демоверсия возвращается к исходному состоянию для следующего гостя.',
  'demo.welcome.resetIn': 'Следующий сброс через',
  'demo.welcome.tryTitle': 'Попробуйте прямо сейчас',
  'demo.feature.planner.title': 'Планировщик поездок',
  'demo.feature.planner.body':
    'Дни, места и маршруты на карте, с перелётами, отелями, ресторанами, бронированиями и общими расходами.',
  'demo.feature.tours.title': 'Туры и походы',
  'demo.feature.tours.body': 'Проложите поход по сети троп и следуйте по нему над 3D рельефом с профилем высот.',
  'demo.feature.studio.title': 'Фотокниги в TREK Studio',
  'demo.feature.studio.body': 'Превратите поездку в свёрстанную фотокнигу, страница за страницей.',
  'demo.feature.collab.title': 'Планируйте вместе вживую',
  'demo.feature.collab.body': 'Все участники поездки сразу видят каждое изменение, с чатом, заметками и опросами.',
  'demo.feature.journey.title': 'Дневник путешествий Journey',
  'demo.feature.journey.body': 'Записи, фото, настроения, плюсы и минусы каждого дня в пути.',
  'demo.feature.atlas.title': 'Карта мира Atlas',
  'demo.feature.atlas.body': 'Страны и регионы, где вы побывали, с вашей статистикой путешествий.',
  'demo.feature.vacay.title': 'Планировщик отпуска Vacay',
  'demo.feature.vacay.body': 'Планируйте выходные вокруг праздников и смотрите, когда все свободны.',
  'demo.feature.collections.title': 'Коллекции',
  'demo.feature.collections.body':
    'Сохраняйте места из разных поездок в собственные списки и копируйте их в любой план.',
  'demo.feature.offline.title': 'Работает офлайн',
  'demo.feature.offline.body': 'Установите TREK как приложение, и планы, карты и списки останутся с вами без связи.',
  'demo.welcome.limitsTitle': 'Недоступно в демоверсии',
  'demo.limit.uploads': 'Загрузка фото, документов и обложек',
  'demo.limit.account': 'Изменение аккаунта, пароля или 2FA',
  'demo.limit.apiKeys': 'Создание ключей API',
  'demo.limit.mcp': 'Подключение клиентов MCP',
  'demo.limit.ai': 'Подключение собственной модели ИИ',
  'demo.welcome.fullTitle': 'В полной версии также есть',
  'demo.full.sso': 'Вход через OIDC и SSO',
  'demo.full.backups': 'Автоматические резервные копии',
  'demo.full.plugins': 'Плагины с новыми функциями',
  'demo.full.assistant': 'ИИ-ассистент на вашей собственной модели',
  'demo.full.admin': 'Панель администратора для пользователей, дополнений и прав',
  'demo.welcome.repo': 'Исходный код на GitHub',
  'demo.welcome.start': 'Начать знакомство',
  'demo.welcome.credits': 'Авторы фотографий',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Авторы фотографий',
  'demo.credits.intro':
    'Фотографии в этой демоверсии взяты с Wikimedia Commons, каждая под лицензией, указанной рядом с ней. Эта лицензия распространяется только на фотографию, а не на TREK или остальную демоверсию.',
  'demo.credits.by': 'Фото: {author}',
  'demo.credits.publicDomain': 'Общественное достояние',
  'demo.credits.back': 'Назад',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Деморежим',
  'demo.lock.apiKeys': 'В демоверсии нельзя создать ключи API.',
  'demo.lock.mcp': 'В демоверсии нельзя подключить клиентов MCP.',
  'demo.lock.ai': 'В демоверсии нельзя добавить собственное подключение к ИИ.',
  'demo.lock.aiTitle': 'Подключить собственную модель ИИ',
  'demo.lock.account': 'Общий демоаккаунт нельзя изменить.',
  'demo.lock.language': 'Демоверсия всегда работает на английском.',
};

export default demo;
