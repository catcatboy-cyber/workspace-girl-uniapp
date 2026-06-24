# Campus Pop 设计系统

## 核心风格
粗黑边 + 硬阴影 + 珊瑚红 Hero + 黄色强调 + 青色正向 + 红色风险。像"情绪手账 + AI 分析报告"的混合气质。
禁止：玻璃拟态、柔和圆角、商务后台、杂志风。

## 颜色 Token（用户端统一）
```
--app-bg: #FFFDF5     页面背景
--ink: #111111         黑边、主文字
--hero: #FF6B6B        Hero 主色
--accent: #FFD93D      标签、高亮、重点
--mint: #4ECDC4        正向、成功、主按钮
--risk: #FF5252        风险、警告
--card: #FFFFFF        卡片底
--accent-soft: #FFFBEB
--risk-soft: #FFEEEC
--mint-soft: #E0FFF0
--text-muted: #666666
--text-soft: #999999
```

## 字号 8 档（禁止使用其他字号）
| 档位 | 字号 | 用途 |
|------|------|------|
| 核心大数字 | 50rpx | 分数展示、大数字 |
| Hero 大标题 | 44rpx | 页面主标题 |
| KPI 数字 | 38rpx | 关键指标数字 |
| 卡片大标题 | 38rpx | section-title-v2 |
| 正文强调 | 36rpx | 按钮、重要文案 |
| 正文 | 34rpx | 描述、说明 |
| 标签/辅助 | 32rpx | 标签、副标题、图表标注 |
| 微型说明 | 24rpx | 脚注、证据来源 |

## 字重
- 大标题/KPI：900
- 卡片标题/标签：800-900
- 正文：600
- 弱说明：600 + 浅色，不用细字重

## 字体
`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`

## 卡片 3 种
1. 基础卡片：`border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; background: #fff`
2. 轻量内嵌：`border: 2rpx solid #111; padding: 16-20rpx; background: #fff`（无阴影）
3. 提示卡片：`border: 2rpx solid #111; border-left: 10rpx solid <语义色>`（accent-soft/risk-soft/mint-soft）

## Hero 固定规范
- 背景：--hero (#FF6B6B)
- 边框：3rpx solid #111
- 阴影：8rpx 8rpx 0 #111
- 旋转：rotate(-0.5deg)
- Hero 内标签：黑底黄字

## 按钮
- 主按钮：mint 底 + 黑边 + 硬阴影
- 次按钮：白底 + 黑边
- 高度：48/64/80rpx

## 图表
- 容器：白底、黑边 2-3rpx
- 网格线：浅黑透明
- 意向/动能线：黑色或青色
- 风险线：红色
- 关键节点：黄色圆点 + 黑边
- 条形图：黑边白底，填充用青色/红色/黑色斜纹
