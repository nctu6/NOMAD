import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Жива демоверсія',
  'demo.welcome.title': 'Ласкаво просимо до TREK',
  'demo.welcome.tagline':
    'Планувальник подорожей для спільної роботи: плануйте разом на мапі в реальному часі, від першої ідеї до фотокниги після поїздки.',
  'demo.welcome.resetTitle': 'Щогодини все скидається',
  'demo.welcome.resetBody':
    'Переглядайте, редагуйте та створюйте скільки завгодно. На початку кожної години демоверсія повертається до початкового стану для наступного гостя.',
  'demo.welcome.resetIn': 'Наступне скидання через',
  'demo.welcome.tryTitle': 'Спробуйте просто зараз',
  'demo.feature.planner.title': 'Планувальник поїздок',
  'demo.feature.planner.body':
    'Дні, місця та маршрути на мапі, з перельотами, готелями, ресторанами, бронюваннями та спільними витратами.',
  'demo.feature.tours.title': 'Тури та походи',
  'demo.feature.tours.body': 'Прокладіть похід мережею стежок і йдіть ним над 3D рельєфом із профілем висот.',
  'demo.feature.studio.title': 'Фотокниги в TREK Studio',
  'demo.feature.studio.body': 'Перетворіть поїздку на зверстану фотокнигу, сторінка за сторінкою.',
  'demo.feature.collab.title': 'Плануйте разом наживо',
  'demo.feature.collab.body': 'Усі учасники поїздки одразу бачать кожну зміну, з чатом, нотатками й опитуваннями.',
  'demo.feature.journey.title': 'Щоденник подорожей Journey',
  'demo.feature.journey.body': 'Записи, фото, настрої, плюси й мінуси кожного дня в дорозі.',
  'demo.feature.atlas.title': 'Мапа світу Atlas',
  'demo.feature.atlas.body': 'Країни та регіони, де ви побували, з вашою статистикою подорожей.',
  'demo.feature.vacay.title': 'Планувальник відпустки Vacay',
  'demo.feature.vacay.body': 'Плануйте вихідні навколо свят і дивіться, коли всі вільні.',
  'demo.feature.collections.title': 'Колекції',
  'demo.feature.collections.body':
    'Зберігайте місця з різних поїздок у власних списках і копіюйте їх у будь який план.',
  'demo.feature.offline.title': 'Працює офлайн',
  'demo.feature.offline.body': 'Встановіть TREK як застосунок, і плани, мапи та списки залишаться з вами без зв’язку.',
  'demo.welcome.limitsTitle': 'Недоступно в демоверсії',
  'demo.limit.uploads': 'Завантаження фото, документів і обкладинок',
  'demo.limit.account': 'Зміна облікового запису, пароля або 2FA',
  'demo.limit.apiKeys': 'Створення ключів API',
  'demo.limit.mcp': 'Підключення клієнтів MCP',
  'demo.limit.ai': 'Підключення власної моделі ШІ',
  'demo.welcome.fullTitle': 'У повній версії також є',
  'demo.full.sso': 'Вхід через OIDC і SSO',
  'demo.full.backups': 'Автоматичні резервні копії',
  'demo.full.plugins': 'Плагіни з новими функціями',
  'demo.full.assistant': 'ШІ-асистент на вашій власній моделі',
  'demo.full.admin': 'Панель адміністратора для користувачів, доповнень і прав',
  'demo.welcome.repo': 'Вихідний код на GitHub',
  'demo.welcome.start': 'Почати знайомство',
  'demo.welcome.credits': 'Автори фотографій',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Автори фотографій',
  'demo.credits.intro':
    'Фотографії в цій демоверсії взято з Wikimedia Commons, кожну під ліцензією, зазначеною поруч. Ця ліцензія стосується лише фотографії, а не TREK чи решти демоверсії.',
  'demo.credits.by': 'Фото: {author}',
  'demo.credits.publicDomain': 'Суспільне надбання',
  'demo.credits.back': 'Назад',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Деморежим',
  'demo.lock.apiKeys': 'У демоверсії не можна створити ключі API.',
  'demo.lock.mcp': 'У демоверсії не можна підключити клієнтів MCP.',
  'demo.lock.ai': 'У демоверсії не можна додати власне підключення до ШІ.',
  'demo.lock.aiTitle': 'Підключити власну модель ШІ',
  'demo.lock.account': 'Спільний демообліковий запис не можна змінити.',
  'demo.lock.language': 'Демоверсія завжди працює англійською.',
};

export default demo;
