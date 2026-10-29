import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': '라이브 데모',
  'demo.welcome.title': 'TREK에 오신 것을 환영합니다',
  'demo.welcome.tagline':
    '함께 쓰는 여행 플래너: 지도 위에서 실시간으로 함께 계획하고, 첫 아이디어부터 여행 후 포토북까지.',
  'demo.welcome.resetTitle': '매시간 모든 것이 초기화됩니다',
  'demo.welcome.resetBody':
    '마음껏 둘러보고 수정하고 만들어 보세요. 매시 정각에 데모는 다음 방문자를 위해 처음 상태로 돌아갑니다.',
  'demo.welcome.resetIn': '다음 초기화까지',
  'demo.welcome.tryTitle': '지금 바로 체험',
  'demo.feature.planner.title': '여행 플래너',
  'demo.feature.planner.body': '지도 위의 일정, 장소, 경로와 함께 항공편, 호텔, 식당, 예약, 공동 비용까지.',
  'demo.feature.tours.title': '투어와 하이킹',
  'demo.feature.tours.body': '등산로 네트워크에서 하이킹을 계획하고 고도 프로필과 함께 3D 지형 위에서 따라가 보세요.',
  'demo.feature.studio.title': 'TREK Studio 포토북',
  'demo.feature.studio.body': '여행을 한 페이지씩 디자인된 포토북으로 만들어 보세요.',
  'demo.feature.collab.title': '실시간으로 함께 계획',
  'demo.feature.collab.body': '여행 멤버 모두가 모든 변경을 바로 보고, 채팅, 메모, 투표도 함께합니다.',
  'demo.feature.journey.title': '여행 일지 Journey',
  'demo.feature.journey.body': '길 위의 매일을 위한 기록, 사진, 기분, 장단점.',
  'demo.feature.atlas.title': '세계 지도 Atlas',
  'demo.feature.atlas.body': '방문한 국가와 지역을 여행 통계와 함께 보여 줍니다.',
  'demo.feature.vacay.title': '휴가 플래너 Vacay',
  'demo.feature.vacay.body': '공휴일에 맞춰 휴가를 계획하고 모두가 비는 날을 확인하세요.',
  'demo.feature.collections.title': '컬렉션',
  'demo.feature.collections.body': '여러 여행의 장소를 나만의 목록에 저장하고 어떤 계획에도 복사하세요.',
  'demo.feature.offline.title': '오프라인에서도 작동',
  'demo.feature.offline.body': 'TREK을 앱으로 설치하면 연결 없이도 계획, 지도, 목록을 쓸 수 있습니다.',
  'demo.welcome.limitsTitle': '데모에서 제외된 기능',
  'demo.limit.uploads': '사진, 문서, 표지 업로드',
  'demo.limit.account': '계정, 비밀번호 또는 2FA 변경',
  'demo.limit.apiKeys': 'API 키 만들기',
  'demo.limit.mcp': 'MCP 클라이언트 연결',
  'demo.limit.ai': '내 AI 모델 연결',
  'demo.welcome.fullTitle': '정식 버전에 추가되는 기능',
  'demo.full.sso': 'OIDC 및 SSO 로그인',
  'demo.full.backups': '자동 백업',
  'demo.full.plugins': '새 기능을 위한 플러그인',
  'demo.full.assistant': '내 모델로 동작하는 AI 어시스턴트',
  'demo.full.admin': '사용자, 애드온, 권한을 위한 관리자 패널',
  'demo.welcome.repo': 'GitHub의 소스 코드',
  'demo.welcome.start': '둘러보기 시작',
  'demo.welcome.credits': '사진 출처',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': '사진 출처',
  'demo.credits.intro':
    '이 데모의 사진은 Wikimedia Commons에서 가져왔으며, 각 사진에는 함께 표시된 라이선스가 적용됩니다. 이 라이선스는 사진에만 적용되며 TREK이나 데모의 나머지 부분에는 적용되지 않습니다.',
  'demo.credits.by': '촬영: {author}',
  'demo.credits.publicDomain': '퍼블릭 도메인',
  'demo.credits.back': '뒤로',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': '데모 모드',
  'demo.lock.apiKeys': '데모에서는 API 키를 만들 수 없습니다.',
  'demo.lock.mcp': '데모에서는 MCP 클라이언트를 연결할 수 없습니다.',
  'demo.lock.ai': '데모에서는 내 AI 연결을 추가할 수 없습니다.',
  'demo.lock.aiTitle': '내 AI 모델 연결',
  'demo.lock.account': '공유 데모 계정은 변경할 수 없습니다.',
  'demo.lock.language': '데모는 항상 영어로 실행됩니다.',
};

export default demo;
