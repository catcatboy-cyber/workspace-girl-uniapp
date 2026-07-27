# 首页雷达改版计划（最简版）

## 目标

把互动天平换成「今日的TA」。

宠物分值可视化**已存在**——`getPetMood()` → `petState` → sprite 动画早已映射好了，不需要额外工作。

## 改动

### 今日的TA（替换互动天平节点）

**文件**：`src/components/CampusSignalHome.vue`

- `cs-node-balance` 节点 → 改为 `cs-node-ta-daily`
- 新增 props：`taDayZhi`、`taSelfZhi`、`taCrushZhi`
- 内容：日支 → 我(三合/六合/六冲/平) | TA(三合/六合/六冲/平) + 一行建议

**文件**：`src/pages/index/index.vue`

- 传入 props：`taohuaTeaserData.ganzhi.dayZhi` + `ZODIAC_TO_ZHI[selfProfile.zodiac]` + `ZODIAC_TO_ZHI[cases[i].profile.zodiac]`
- 删除 `balanceCallout` 相关代码

## 验证

```
npm run build:mp-weixin
npm run test:regression
```
