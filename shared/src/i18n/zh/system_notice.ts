import type { TranslationStrings } from '../types';

const system_notice: TranslationStrings = {
  'system_notice.welcome_v1.title': '欢迎使用 TREK',
  'system_notice.welcome_v1.body': '您的全能旅行规划器。制定行程、与朋友分享旅行，随时保持井然有序——在线或离线均可。',
  'system_notice.welcome_v1.cta_label': '规划行程',
  'system_notice.welcome_v1.hero_alt': '风景优美的旅游目的地与 TREK 界面',
  'system_notice.welcome_v1.highlight_plan': '逐日行程规划',
  'system_notice.welcome_v1.highlight_share': '与旅行伙伴协作',
  'system_notice.welcome_v1.highlight_offline': '移动端支持离线使用',
  'system_notice.dev_test_modal.title': '[开发] 测试通知',
  'system_notice.dev_test_modal.body': '这是一条仅用于开发环境的测试通知。',
  'system_notice.thank_you_support.title': '感谢你使用 TREK',
  'system_notice.thank_you_support.body':
    '想跟你说声谢谢——谢谢你安装了 TREK，这对我来说真的意义非凡。\n\n我是一名独立开发者，TREK 是我利用业余时间打造的。它最初只是我为自己的旅行做的一个小工具，而社区一路以来给予的支持和关注，老实说让我感到无比惊喜。TREK 是我用满满的热爱做出来的——但也离不开许多了不起的外部贡献者，是他们一起塑造了今天的它。\n\n**TREK 是开源的，完全免费——而且永远都会如此。没有付费档位，没有订阅，没有任何套路。我保证。**\n\n如果 TREK 对你有帮助，并且你愿意支持它的开发，请我喝一杯小小的咖啡，真的能帮我把它继续做下去——完全没有任何压力，但每一杯都让那些挑灯夜战的夜晚有了坚持的动力。\n\n谢谢你来到这里。\n\n— Maurice',
  'system_notice.thank_you_support.highlight_opensource': '在 GitHub 上 100% 开源',
  'system_notice.thank_you_support.highlight_free': '永久免费——绝无付费档位',
  'system_notice.thank_you_support.highlight_community': '与社区一起共建',
  'system_notice.thank_you_support.cta_bmc': '请我喝杯咖啡',
  'system_notice.thank_you_support.cta_kofi': '在 Ko-fi 上支持',
  'system_notice.pager.prev': '上一条通知',
  'system_notice.pager.next': '下一条通知',
  'system_notice.pager.counter': '{current} / {total}',
  'system_notice.pager.goto': '转到通知 {n}',
  'system_notice.pager.position': '通知 {current}/{total}',
  'system_notice.v3_photos.title': '3.0 版照片已迁移',
  'system_notice.v3_photos.body':
    '旅行规划器中的​**照片**标签已被移除。您的照片安全无虑 — TREK 从未修改您的 Immich 或 Synology 相册。\n\n照片现在位于 **旅程** 插件中。旅程是可选的 — 如果尚未启用，请联系管理员在 Admin → 插件 中开启。',
  'system_notice.v3_journey.title': '认识旅程 — 旅行日记',
  'system_notice.v3_journey.body': '将您的旅程记录为展示时间线、照片画廊和互动地图的丰富旅行故事。',
  'system_notice.v3_journey.cta_label': '打开旅程',
  'system_notice.v3_journey.highlight_timeline': '每日时间线与画廊',
  'system_notice.v3_journey.highlight_photos': '从 Immich 或 Synology 导入',
  'system_notice.v3_journey.highlight_share': '公开分享 — 无需登录',
  'system_notice.v3_journey.highlight_export': '导出为 PDF 相册书',
  'system_notice.v3_features.title': '3.0 版更多亮点',
  'system_notice.v3_features.body': '此版本还有一些其他值得了解的新功能。',
  'system_notice.v3_features.highlight_dashboard': '移动优先仪表板重设计',
  'system_notice.v3_features.highlight_offline': '作为 PWA 的完整离线模式',
  'system_notice.v3_features.highlight_search': '地点搜索实时自动补全',
  'system_notice.v3_features.highlight_import': '从 KMZ/KML 文件导入地点',
  'system_notice.v3_mcp.title': 'MCP：OAuth 2.1 升级',
  'system_notice.v3_mcp.body':
    'MCP 集成已全面重构。OAuth 2.1 现为推荐的身份验证方式。静态令牌（trek_…）已弃用，将在未来版本中移除。',
  'system_notice.v3_mcp.highlight_oauth': 'OAuth 2.1 推荐（mcp-remote）',
  'system_notice.v3_mcp.highlight_scopes': '24 个细粒度权限范围',
  'system_notice.v3_mcp.highlight_deprecated': '静态 trek_ 令牌已弃用',
  'system_notice.v3_mcp.highlight_tools': '扩展工具集与提示词',
  'system_notice.v3_thankyou.title': '来自我的一封私人信',
  'system_notice.v3_thankyou.body':
    '在你继续之前——我想停下来说几句。\n\nTREK 最初只是我为自己的旅行而做的一个业余项目。我从未想过它会成长为 4,000 人信赖的冒险规划工具。每一颗星标、每一个 issue、每一个功能请求——我都会读，它们在全职工作和大学学业之间的深夜里支撑着我继续前行。\n\n我想让你们知道：TREK 将永远开源，永远可自托管，永远属于你们。没有追踪，没有订阅，没有任何附加条件。只是一个热爱旅行的人为同样热爱旅行的你们打造的工具。\n\n特别感谢 [jubnl](https://github.com/jubnl)——你已经成为一位不可思议的合作者。3.0 版本中许多精彩之处都留下了你的印记。感谢你在这个项目还很粗糙的时候就选择了相信它。\n\n也感谢你们每一位——报告了 bug、翻译了文本、向朋友分享了 TREK，或者只是用它规划了一次旅行——**谢谢你们**。你们是这一切存在的原因。\n\n愿我们一起踏上更多的冒险旅程。\n\n— Maurice\n\n---\n\n[加入 Discord 社区](https://discord.gg/7Q6M6jDwzf)\n\n如果 TREK 让你的旅行更美好，一杯[小小的咖啡](https://ko-fi.com/mauriceboe)能让这盏灯一直亮着。',
  'system_notice.v3014_whitespace_collision.title': '需要操作：用户账户冲突',
  'system_notice.v3014_whitespace_collision.body':
    '3.0.14 版本升级检测到一个或多个由存储账户中首尾空白字符引发的用户名或邮箱冲突。受影响的账户已自动重命名。请检查服务器日志中以 **[migration] WHITESPACE COLLISION** 开头的行，以确认哪些账户需要审查。',
  // The release modal. One stable set of keys: each big release swaps the copy in place.
  'system_notice.release_notes.eyebrow': '更新已安装',
  'system_notice.release_notes.headline': '迄今最大的 TREK。',
  'system_notice.release_notes.intro':
    '适合每一个户外日子的游览、为你的相册而生的工作室、与你一起规划的助手，以及每个页面上的帮助。',
  'system_notice.release_notes.features_label': '本次重头戏',
  'system_notice.release_notes.features_aside': '远不止这些',
  'system_notice.release_notes.feature_tours_title': '游览',
  'system_notice.release_notes.feature_tours_body':
    '徒步、骑行、跑步、骑马、划桨、城市漫步和滑雪日，附带海拔剖面、难度等级和 3D 飞览。',
  'system_notice.release_notes.feature_studio_title': 'TREK Studio', // same-as-en
  'system_notice.release_notes.feature_studio_body':
    '把一段旅程变成精心设计的相册：17 种主题、34 款字体、160 枚贴纸，一键自动排版。',
  'system_notice.release_notes.feature_assistant_title': 'AI 助手',
  'system_notice.release_notes.feature_assistant_body':
    '用你已有的 AI 账户，在你真实的旅行中与你一起规划。每项更改都会先展示给你，并且可以撤销。',
  'system_notice.release_notes.feature_help_title': '每个页面都有帮助，支持 27 种语言',
  'system_notice.release_notes.feature_help_body':
    '约 370 篇分步指南、1,600 张配图，就在你需要的地方。新增阿塞拜疆语、爱沙尼亚语、斯洛伐克语和泰语。',
  'system_notice.release_notes.footnote': '除此之外，TREK 的其他部分还有一长串小改动。',
  'system_notice.release_notes.notes_label': '更新说明',
  'system_notice.release_notes.note_eyebrow': '来自维护者的话',
  'system_notice.release_notes.note_title': '是你们让我一直坚持做 TREK。',
  'system_notice.release_notes.note_body':
    'TREK 最初只是我为自己的旅行做的小工具，下班后一点点写出来，只因为我想更好地规划旅行。后来它就再没停止过成长。你用到的几乎每一样功能，都是在全职工作之外，在深夜、周末和火车上做出来的。也有很多个晚上，我会默默地想，这世上究竟会不会有人打开它。',
  'system_notice.release_notes.promise_label': '承诺',
  'system_notice.release_notes.promise_lead': 'TREK 永远免费。',
  'system_notice.release_notes.promise_text': '每个功能、每次更新，都属于每一个人。没有付费档位，没有订阅，没有套路。',
  'system_notice.release_notes.note_body_after':
    '后来，你们真的来了。短短几个月，就来了成千上万的你们：有人点星标、报 bug，有人把它翻译成我不会说的语言，还有素未谋面的人提交 pull request。直到今天，我每天早上第一件事仍是打开仓库看看，而这一切还是有点不像真的。',
  'system_notice.release_notes.note_closing': '谢谢你来到这里，Maurice 敬上。',
  'system_notice.release_notes.support_lead': 'TREK 现在免费，以后也永远免费，但服务器、域名和无数个深夜可不是免费的。',
  'system_notice.release_notes.support_text':
    '如果它已经在你的旅行中占有一席之地，请我喝杯咖啡，帮我把下一个版本继续做出来吧。',
  'system_notice.release_notes.cta_bmc': '请我喝杯咖啡',
  'system_notice.release_notes.cta_kofi': '在 Ko-fi 上支持',
};
export default system_notice;
