# 2026-06-11 工作总结

## 一、Crush Master 分享图重设计

- 将小程序通用分享图从旧的 Dom-Crush/Crush Notes 风格更新为 Crush Master 视觉。
- 使用 `gpt-image-2` 生成通用分享图 `src/static/share-card.png`：
  - 5:4 分享卡比例
  - Campus Pop 硬边 UI 风格
  - 包含关系信号看板、互动趋势、CTA 等页面化信息
- 使用 `gpt-image-2` 生成桃花人格分享图 `src/static/share-taohua-persona.png`：
  - 从第一版柔和海报风重新收紧为小程序页面截图式 UI
  - 保留命理桃花主题，但改为硬边边框、卡片阴影、顶部栏、内容卡、底部 CTA 的程序页面结构

## 二、桃花人格分享链路调整

- 将 `src/pages/taohua/taohua.vue` 的隐藏 canvas 从竖版 `640x960` 调整为 `640x512`。
- 目的：匹配微信小程序分享卡 5:4 展示比例，避免竖版海报在转发卡片里被裁切或观感偏差。
- 桃花人格分享逻辑：
  - 点击“分享我的桃花人格卡”时优先生成动态 canvas 分享图
  - 未生成成功时 fallback 到 `/static/share-taohua-persona.png`
- `src/pages/taohua-share/taohua-share.vue` 二次分享增加固定分享图 `/static/share-taohua-persona.png`。
- `src/utils/share.js` 的通用分享标题更新为 `Crush Master｜读懂关系信号`。

## 三、gpt-image-2 生成环境打通

- 新增 `.env.local` 模板，用于本地配置：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `IMAGE_MODEL=gpt-image-2`
- 发现当前 `OPENAI_BASE_URL=https://code.newcli.com/codex` 直接调用会返回 404。
- 处理方式：调用时自动补 `/v1`，实际请求路径使用 `https://code.newcli.com/codex/v1`。
- 系统自带 imagegen CLI 能发起请求，但代理返回的是图片 URL，不是 CLI 预期的 `b64_json`，因此会在保存阶段失败。

## 四、生成脚本

- 新增 `scripts/generate_share_images_openai.py`：
  - 读取 `.env.local`
  - 自动补齐 `/v1`
  - 使用 `IMAGE_MODEL` 指定模型，当前为 `gpt-image-2`
  - 兼容 `b64_json` 和 `url` 两种图片返回格式
  - 生成高清原图到 `output/imagegen/`
  - 覆盖安装到 `src/static/`
  - 支持 `--only common` / `--only taohua` / `--only all`
- 新增 `scripts/generate-share-images.ps1`：
  - 作为 PowerShell 版本复跑脚本
  - 已修复失败后继续复制不存在文件的问题

## 五、资源优化

- `gpt-image-2` 生成的原图为 `1280x1024`：
  - `output/imagegen/share-card-gpt-image-2.png`
  - `output/imagegen/share-taohua-persona-gpt-image-2.png`
- 小程序实际打包资源压缩为 `500x400`：
  - `src/static/share-card.png` 约 289KB
  - `src/static/share-taohua-persona.png` 约 234KB
- 保留高清原图，运行时使用轻量压缩图，降低小程序包体压力。

## 六、验证

- 已预览两张压缩后的分享图，文字和主视觉均可读。
- 已运行：

```bash
npm.cmd run build:mp-weixin
```

- 构建通过。
- `dist/build/mp-weixin/static/` 中已包含新的两张分享图。

## 七、注意事项

- 小程序运行时不会调用 `gpt-image-2`，不会暴露 API key。
- `gpt-image-2` 仅用于开发期生成静态素材。
- 后续如需重生成分享图，直接运行：

```bash
python scripts/generate_share_images_openai.py --only all
```

