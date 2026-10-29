import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Élő demó',
  'demo.welcome.title': 'Üdv a TREK-ben',
  'demo.welcome.tagline':
    'A megosztható útitervező: tervezzetek együtt a térképen valós időben, az első ötlettől az utazás utáni fotókönyvig.',
  'demo.welcome.resetTitle': 'Óránként minden visszaáll',
  'demo.welcome.resetBody':
    'Nézz körül, szerkessz és hozz létre bármit. Minden egész órakor a demó visszatér a kiinduló állapotába a következő látogató számára.',
  'demo.welcome.resetIn': 'Következő visszaállítás',
  'demo.welcome.tryTitle': 'Próbáld ki most',
  'demo.feature.planner.title': 'Útitervező',
  'demo.feature.planner.body':
    'Napok, helyek és útvonalak a térképen, járatokkal, szállodákkal, éttermekkel, foglalásokkal és közös költségekkel.',
  'demo.feature.tours.title': 'Túrák és kirándulások',
  'demo.feature.tours.body': 'Tervezz túrát az ösvényhálózaton, és kövesd 3D terepen a magassági profillal.',
  'demo.feature.studio.title': 'Fotókönyvek a TREK Studióban',
  'demo.feature.studio.body': 'Alakíts egy utazást oldalról oldalra megtervezett fotókönyvvé.',
  'demo.feature.collab.title': 'Közös tervezés élőben',
  'demo.feature.collab.body':
    'Az utazás minden tagja azonnal látja a változásokat, csevegéssel, jegyzetekkel és szavazásokkal.',
  'demo.feature.journey.title': 'Journey útinapló',
  'demo.feature.journey.body': 'Bejegyzések, fotók, hangulatok, előnyök és hátrányok az út minden napjáról.',
  'demo.feature.atlas.title': 'Atlas világtérkép',
  'demo.feature.atlas.body': 'Az általad bejárt országok és régiók, utazási statisztikákkal.',
  'demo.feature.vacay.title': 'Vacay szabadságtervező',
  'demo.feature.vacay.body': 'Tervezd a szabadnapjaidat az ünnepek köré, és lásd, mikor ér rá mindenki.',
  'demo.feature.collections.title': 'Gyűjtemények',
  'demo.feature.collections.body': 'Ments helyeket különböző utakról saját listákba, és másold őket bármelyik tervbe.',
  'demo.feature.offline.title': 'Offline is működik',
  'demo.feature.offline.body':
    'Telepítsd a TREK-et alkalmazásként, és tartsd meg a terveket, térképeket és listákat kapcsolat nélkül is.',
  'demo.welcome.limitsTitle': 'Nem része a demónak',
  'demo.limit.uploads': 'Fotók, dokumentumok és borítók feltöltése',
  'demo.limit.account': 'A fiók, a jelszó vagy a 2FA módosítása',
  'demo.limit.apiKeys': 'API-kulcsok létrehozása',
  'demo.limit.mcp': 'MCP-kliensek csatlakoztatása',
  'demo.limit.ai': 'Saját AI-modell csatlakoztatása',
  'demo.welcome.fullTitle': 'A teljes verzióban ezen felül',
  'demo.full.sso': 'Bejelentkezés OIDC és SSO segítségével',
  'demo.full.backups': 'Automatikus biztonsági mentések',
  'demo.full.plugins': 'Bővítmények új funkciókhoz',
  'demo.full.assistant': 'Az AI-asszisztens saját modellel',
  'demo.full.admin': 'Adminfelület felhasználókhoz, kiegészítőkhöz és jogosultságokhoz',
  'demo.welcome.repo': 'Forráskód a GitHubon',
  'demo.welcome.start': 'Felfedezés indítása',
  'demo.welcome.credits': 'Fotók szerzői',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Fotók szerzői',
  'demo.credits.intro':
    'A demó fotói a Wikimedia Commonsról származnak, mindegyik a mellette feltüntetett licenccel. Ez a licenc csak a fotóra vonatkozik, a TREK-re és a demó többi részére nem.',
  'demo.credits.by': 'Fotó: {author}',
  'demo.credits.publicDomain': 'Közkincs',
  'demo.credits.back': 'Vissza',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Demó mód',
  'demo.lock.apiKeys': 'A demóban nem hozhatók létre API-kulcsok.',
  'demo.lock.mcp': 'A demóban nem csatlakoztathatók MCP-kliensek.',
  'demo.lock.ai': 'A demóban nem adható hozzá saját AI-kapcsolat.',
  'demo.lock.aiTitle': 'Saját AI-modell csatlakoztatása',
  'demo.lock.account': 'A közös demófiók nem módosítható.',
  'demo.lock.language': 'A demó mindig angolul fut.',
};

export default demo;
