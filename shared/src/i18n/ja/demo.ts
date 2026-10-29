import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'ライブデモ',
  'demo.welcome.title': 'TREK へようこそ',
  'demo.welcome.tagline':
    '共有できる旅行プランナー。地図の上でリアルタイムに一緒に計画し、最初のアイデアから旅のあとのフォトブックまで。',
  'demo.welcome.resetTitle': '毎時すべてがリセットされます',
  'demo.welcome.resetBody':
    '自由に見て、編集して、作成してください。毎正時にデモは次の訪問者のために最初の状態へ戻ります。',
  'demo.welcome.resetIn': '次のリセットまで',
  'demo.welcome.tryTitle': 'さっそく試す',
  'demo.feature.planner.title': '旅行プランナー',
  'demo.feature.planner.body': '地図上の日程、スポット、ルートに、フライト、ホテル、レストラン、予約、共有費用まで。',
  'demo.feature.tours.title': 'ツアーとハイキング',
  'demo.feature.tours.body': '登山道のネットワークでハイキングを計画し、標高プロファイル付きの 3D 地形でたどれます。',
  'demo.feature.studio.title': 'TREK Studio のフォトブック',
  'demo.feature.studio.body': '旅をページごとにデザインされたフォトブックに仕上げます。',
  'demo.feature.collab.title': 'ライブで一緒に計画',
  'demo.feature.collab.body': '旅のメンバー全員が変更をすぐに確認でき、チャット、メモ、投票も使えます。',
  'demo.feature.journey.title': '旅行記 Journey',
  'demo.feature.journey.body': '旅の毎日の記録、写真、気分、良かった点と気になった点。',
  'demo.feature.atlas.title': '世界地図 Atlas',
  'demo.feature.atlas.body': '訪れた国と地域を、旅の統計とともに。',
  'demo.feature.vacay.title': '休暇プランナー Vacay',
  'demo.feature.vacay.body': '祝日に合わせて休みを計画し、みんなが空いている日がわかります。',
  'demo.feature.collections.title': 'コレクション',
  'demo.feature.collections.body': '旅をまたいでスポットを自分のリストに保存し、どのプランにもコピーできます。',
  'demo.feature.offline.title': 'オフラインでも動作',
  'demo.feature.offline.body': 'TREK をアプリとしてインストールすれば、接続がなくてもプラン、地図、リストを使えます。',
  'demo.welcome.limitsTitle': 'デモでは使えないもの',
  'demo.limit.uploads': '写真、書類、カバー画像のアップロード',
  'demo.limit.account': 'アカウント、パスワード、2FA の変更',
  'demo.limit.apiKeys': 'API キーの作成',
  'demo.limit.mcp': 'MCP クライアントの接続',
  'demo.limit.ai': '自分の AI モデルの接続',
  'demo.welcome.fullTitle': 'フル版で追加されるもの',
  'demo.full.sso': 'OIDC と SSO によるサインイン',
  'demo.full.backups': '自動バックアップ',
  'demo.full.plugins': '新機能を加えるプラグイン',
  'demo.full.assistant': '自分のモデルで動く AI アシスタント',
  'demo.full.admin': 'ユーザー、アドオン、権限を管理する管理画面',
  'demo.welcome.repo': 'GitHub のソースコード',
  'demo.welcome.start': '使ってみる',
  'demo.welcome.credits': '写真のクレジット',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': '写真のクレジット',
  'demo.credits.intro':
    'このデモの写真は Wikimedia Commons のもので、それぞれ横に記載したライセンスで公開されています。そのライセンスは写真にのみ適用され、TREK やデモのほかの部分には適用されません。',
  'demo.credits.by': '撮影：{author}',
  'demo.credits.publicDomain': 'パブリックドメイン',
  'demo.credits.back': '戻る',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'デモモード',
  'demo.lock.apiKeys': 'デモでは API キーを作成できません。',
  'demo.lock.mcp': 'デモでは MCP クライアントを接続できません。',
  'demo.lock.ai': 'デモでは自分の AI 接続を追加できません。',
  'demo.lock.aiTitle': '自分の AI モデルを接続',
  'demo.lock.account': '共有のデモアカウントは変更できません。',
  'demo.lock.language': 'デモは常に英語で動作します。',
};

export default demo;
