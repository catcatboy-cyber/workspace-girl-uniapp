# 工作总结 2026-05-28

## 陪伴形象改版
- me 页面宠物选择从 2 列网格改为"单帧头像 + 换只宠物按钮 + bottom sheet 选择面板"
- 从 xiaomi/doggo 帧目录提取 idle/00.png 作为 avatar.png，干净单图展示
- 下载去重：已缓存的云宠物不重复下载，面板显示「已下载」/「下载」状态
- 新增「定制专属宠物」入口 → custom-pet.vue 表单页（昵称 + 描述 + 参考图上传）
- 新增 customPet 云函数（wx-server-sdk），后台 admin 增加「宠物需求」管理 tab

## 全端字体/灰度/风格统一
- 审计 30 个文件的字体大小和灰度颜色
- 统一标准：hero-title 48rpx、section-title 22rpx、card-text 24rpx、btn 22-24rpx
- 灰度从 28 个值收敛到 5 级（#111、#555、#666、#999、#e0e0e0）
- token-recharge.vue 完全重写为 v2-mode 硬边风格
- 清理 8 个未使用 tabbar SVG、2 个冗余 PNG、XiaomiPet.vue 死组件

## 时间轴统计筛选重构
- 关键事件 tab：6 个独立 stat → 2 个对比框（谁更主动 / 承诺与兑现），点击筛选
- Filter chips 改为动态场景扫描（见面/电影/吃饭/咖啡奶茶等），AI 新增场景自动显示
- 承诺与兑现框增加第三列「取消/拒绝」
- 分析记录 tab：删除 filter chips 行，stats 从 5 项→8 项（4×2），补全意向/风险下降 + 全部 + 高风险
- 删除「AI 分析」和「事件重算」等无意义统计/筛选

## TabBar 重设计
- 五个 tab：今日 · 我们 · Crushes · 往事 · 我
- Crushes 为中间圆形浮起按钮（黑底黄字），超出 tabBar 上沿
- 启用微信自定义 tabBar（custom-tab-bar 原生组件 + postbuild 复制脚本）
- tabBar z-index 降到 10，底部弹窗/宠物栏不再被遮挡

## 文案口语化
- 首页：记一笔→记上！ / 📎 图片→甩张图 / 🎤 语音录入→说两句
- 关系：去生成本周 AI 复盘→本周复盘 / 暂无新事件→还没新事件
- 侧写→星象速写 / 生成属相星座侧写→一眼看穿
- Crushes：创建新的关系对象→开个新的
- 充值：Token 充值→充点Token能量 / Token 额度→能量
- 登录：微信手机号一键登录→微信一键登录
- 宠物：更换形象→换只宠物
- 时间轴：回到时间轴事件→跳到这条事件
- 周复盘：返回主页→回去 / 时间轴→往事

## 其他修复
- petLines 云函数：AI 回复解析增加 markdown 代码块剥离 + 中文 tone key 映射 + 多层 fallback
- PetSpeakSheet：修复 toneOptions 缺少 .value 的 bug
- 周复盘页面：增加本地缓存，首次打开秒展

## 包体积缩减 48.5%（3.3MB → 1.7MB）
- doggo 1.6MB spritesheet.webp 云端化：本地文件移至 `C:\Users\Administrator\doggo-pet-backup/`，仅保留 48KB avatar
- `pets.js`：doggo spritesheetPath 指向 xiaomi 占位；`getResolvedSpritesheetPath()` 云宠物无缓存时返回 xiaomi fallback
- `index.vue`：`syncSelectedPet()` 改为 async，await 下载后用 `petAssetsVersion` 触发响应式刷新
- 移除 `project.config.json` 中 doggo packOptions ignore 规则
- 首次打开小程序下载量减半（弱网 ~17s → ~8.5s）

## UI 风格全站统一（V2 硬核海报风）

### 页面层：4 个经典暖色页转 V2
| 页面 | 改动 |
|------|------|
| **ai-settings** | 暖金古典 + 三段式 CSS（649行）→ 纯 V2（300行） |
| **edit-profile** | 同上（430行 → 240行） |
| **reassess** | 同上（209行 → 120行） |
| **assessments** | 最复杂页面，含评分/趋势/状态/侧写/AI面板（989行 → 280行） |

核心变化：`#123c36`/`#c9a45c`/`#201914` → `#111`/`#FFD93D`/`#FF6B6B`/`#4ECDC4`；软阴影圆角 → 硬阴影直角。

### 组件层：4 个组件转 V2
| 组件 | 问题 | 修复 |
|------|------|------|
| **PetSpeakSheet** | 结果卡片绿底、策略区橙色、圆角 | 白底硬阴影、#111/#FFD93D 配色、去圆角、安全提示色统一 |
| **ProfileAvatar** | 经典暖色渐变 | #FFD93D 底 + #111 边框 |
| **AssessmentTrendChart** | 图表全用经典暖色 | #111 intent / #FF5252 risk / 3rpx #111 图表边框 |
| **CaseProfileFields** | 暖色边框 + 圆角 | 3rpx solid #111 + 无圆角 |

### 安全审计
- 小咪帮你说后端 petLines 云函数含三层安全护栏（15 个敏感词、system prompt 注入、种子语料过滤）
- 前端 6 个关键词 + 未成年隐藏"暧昧轻撩"语气

## AI 分析进度提示优化
- 读秒指示器从"记一笔"下方移至"本次分析"卡片内，替换静态"AI 正在生成…"文案
- 黄色脉冲方块动画（每秒缩放闪烁）
- `aiPending=true` 但 loading 未开始时显示"等待中"兜底

## Bug 修复
- `index.vue` 缺少 `isPetCachedLocally` import → 运行时报错 → 已修复
- 4 个页面模板智能引号导致 Vue 编译失败 → perl 批量替换

## 测试
- pet-smoke.cjs 重写：32 项全部通过（spritesheet/avatar 资源、构建产物、死代码清理、tabBar 集成）
